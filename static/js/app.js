const state = {
  users: [],
  tickets: [],
  knowledge: [],
  selectedUserId: null,
  currentUser: null,
  currentTicketId: null,
};

const template = {
  statusClass: (status) => {
    const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
    return normalized;
  },
  priorityClass: (priority) => String(priority || '').trim().toLowerCase(),
};

function isClientUser() {
  return (state.currentUser?.role || '').toLowerCase() === 'cliente';
}

function applyRoleContext() {
  const dashboardButton = document.querySelector('[data-section="dashboard"]');
  const ticketsButton = document.querySelector('[data-section="tickets"]');
  const knowledgeButton = document.querySelector('[data-section="knowledge"]');
  const dashboardHeader = document.querySelector('#dashboard .panel-header h3');
  const ticketsHeader = document.querySelector('#tickets .panel-header h3');
  const knowledgeHeader = document.querySelector('#knowledge .panel-header h3');
  const newKnowledgeButton = document.getElementById('newKnowledgeButton');

  if (isClientUser()) {
    dashboardButton.hidden = true;
    ticketsButton.textContent = 'Mis tickets';
    knowledgeButton.textContent = 'Conocimiento';
    dashboardHeader.textContent = 'Resumen de mis incidencias';
    ticketsHeader.textContent = 'Mis tickets';
    knowledgeHeader.textContent = 'Base de conocimiento';
    newKnowledgeButton.hidden = true;
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    ticketsButton.classList.add('active');
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.getElementById('tickets').classList.add('active');
    document.getElementById('pageTitle').textContent = 'Mis tickets';
  } else {
    dashboardButton.hidden = false;
    dashboardButton.textContent = 'Dashboard';
    ticketsButton.textContent = 'Tickets';
    knowledgeButton.textContent = 'Conocimiento';
    dashboardHeader.textContent = 'Resumen de incidencias';
    ticketsHeader.textContent = 'Listado de tickets';
    knowledgeHeader.textContent = 'Base de conocimiento';
    newKnowledgeButton.hidden = false;
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    dashboardButton.classList.add('active');
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('pageTitle').textContent = 'Dashboard';
  }
}

async function loadUsers() {
  const response = await fetch('/api/users');
  if (!response.ok) throw new Error('No se pudo cargar la lista de usuarios.');
  state.users = await response.json();
  updateUserBadge();
}

async function loadTickets() {
  const response = await fetch('/api/tickets');
  if (response.status === 401) {
    showAuthenticatedView(false);
    return;
  }
  if (!response.ok) throw new Error('No se pudieron cargar los tickets.');

  const allTickets = await response.json();
  const visibleTickets = isClientUser()
    ? allTickets.filter((ticket) => Number(ticket.requested_by_id) === Number(state.currentUser.id))
    : allTickets;

  state.tickets = visibleTickets;
  renderDashboard();
  renderTicketsTable();
}

function updateUserBadge() {
  const badge = document.getElementById('userBadge');
  const roleLabel = isClientUser() ? 'Cliente' : state.currentUser.role;
  badge.textContent = `${state.currentUser.full_name} • ${roleLabel}`;
}

function showAuthenticatedView(isAuthenticated) {
  document.getElementById('loginScreen').hidden = isAuthenticated;
  document.getElementById('appShell').hidden = !isAuthenticated;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function toggleModal(open, mode = 'detail') {
  const modal = document.getElementById('ticketModal');
  modal.classList.toggle('hidden', !open);
  document.body.classList.toggle('modal-open', open);
  modal.dataset.mode = mode;
}

function showLoginError(message) {
  const error = document.getElementById('loginError');
  error.textContent = message;
  error.hidden = false;
}

async function enterApplication(user) {
  state.currentUser = user;
  state.selectedUserId = user.id;
  applyRoleContext();
  await loadUsers();
  await loadTickets();
  await loadKnowledge();
  updateUserBadge();
  showAuthenticatedView(true);
}

async function loadKnowledge() {
  const response = await fetch('/api/knowledge');
  if (response.status === 401) {
    showAuthenticatedView(false);
    return;
  }
  if (!response.ok) throw new Error('No se pudo cargar la base de conocimiento.');

  state.knowledge = await response.json();
  renderKnowledge();
}

function renderKnowledge() {
  const articles = state.knowledge || [];
  const cards = articles.map((article) => {
    const steps = (article.steps || '')
      .split('\n')
      .filter((step) => step.trim())
      .map((step) => `<li>${escapeHtml(step.trim().replace(/^\d+[.)\-\s]*/, ''))}</li>`)
      .join('');

    const tags = article.tags
      ? article.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => `<span class="knowledge-tag">${escapeHtml(tag)}</span>`).join('')
      : '';

    return `
      <article class="knowledge-card">
        <div class="knowledge-meta">
          <span class="badge knowledge-category">${escapeHtml(article.category || 'General')}</span>
          <span class="knowledge-date">${new Date(article.created_at).toLocaleDateString('es-DO')}</span>
        </div>
        <h4>${escapeHtml(article.title)}</h4>
        <p>${escapeHtml(article.summary)}</p>
        <div class="knowledge-steps">
          <strong>Pasos</strong>
          <ol>${steps || '<li>Sin pasos registrados.</li>'}</ol>
        </div>
        ${tags ? `<div class="knowledge-tags">${tags}</div>` : ''}
        <small>Publicado por ${escapeHtml(article.created_by || 'Admin')}</small>
      </article>
    `;
  }).join('');

  document.getElementById('knowledgeGrid').innerHTML = cards || '<div class="empty-state">Sin soluciones publicadas todavía.</div>';
}

function renderDashboard() {
  const total = state.tickets.length;
  const open = state.tickets.filter((t) => ['Nuevo', 'Asignado', 'En progreso', 'Esperando usuario'].includes(t.status)).length;
  const resolved = state.tickets.filter((t) => ['Resuelto', 'Cerrado'].includes(t.status)).length;
  const urgent = state.tickets.filter((t) => t.priority === 'Urgente').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statOpen').textContent = open;
  document.getElementById('statResolved').textContent = resolved;
  document.getElementById('statUrgent').textContent = urgent;

  const rows = state.tickets.slice(0, 5).map((ticket) => `
    <tr>
      <td><strong>${ticket.code}</strong></td>
      <td>${ticket.title}</td>
      <td><span class="badge ${template.statusClass(ticket.status)}">${ticket.status}</span></td>
      <td><span class="badge ${template.priorityClass(ticket.priority)}">${ticket.priority}</span></td>
      <td>${ticket.requester_name}</td>
    </tr>
  `).join('');

  const requesterHeader = isClientUser() ? 'Solicitante' : 'Solicitante';
  document.getElementById('dashboardTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Ticket</th>
          <th>Estado</th>
          <th>Prioridad</th>
          <th>${requesterHeader}</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5">Sin tickets registrados</td></tr>'}</tbody>
    </table>
  `;
}

function renderTicketsTable() {
  const rows = state.tickets.map((ticket) => `
    <tr class="ticket-row" data-id="${ticket.id}">
      <td>${ticket.code}</td>
      <td>${ticket.title}</td>
      <td><span class="badge ${template.statusClass(ticket.status)}">${ticket.status}</span></td>
      <td><span class="badge ${template.priorityClass(ticket.priority)}">${ticket.priority}</span></td>
      <td>${ticket.requester_name}</td>
      <td>${ticket.assigned_to_name || 'Sin asignar'}</td>
      <td>${new Date(ticket.created_at).toLocaleDateString('es-DO')}</td>
    </tr>
  `).join('');

  const assignedHeader = isClientUser() ? 'Estado técnico' : 'Asignado';
  document.getElementById('ticketsTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Resumen</th>
          <th>Estado</th>
          <th>Prioridad</th>
          <th>Solicitante</th>
          <th>${assignedHeader}</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7">Sin tickets</td></tr>'}</tbody>
    </table>
  `;

  document.querySelectorAll('.ticket-row').forEach((row) => {
    row.addEventListener('click', () => openTicket(row.dataset.id));
  });
}

function openNewTicketModal() {
  const modal = document.getElementById('ticketModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.textContent = 'Nuevo ticket';
  modalBody.innerHTML = `
    <form id="newTicketModalForm" class="form-panel">
      <div class="form-grid">
        <label>
          Título
          <input type="text" name="title" required placeholder="Ej. Fallo de internet en producción" />
        </label>
        <label>
          Categoría
          <select name="category">
            <option>Hardware</option>
            <option>Software</option>
            <option>Red</option>
            <option>Acceso</option>
            <option>Impresora</option>
          </select>
        </label>
        <label>
          Prioridad
          <select name="priority">
            <option>Baja</option>
            <option selected>Media</option>
            <option>Alta</option>
            <option>Urgente</option>
          </select>
        </label>
        <label>
          Canal
          <select name="channel">
            <option>WhatsApp</option>
            <option>Llamada</option>
            <option>Correo</option>
            <option>Verbal</option>
          </select>
        </label>
      </div>
      <label>
        Descripción
        <textarea name="description" rows="5" required placeholder="Describa el problema o la solicitud..."></textarea>
      </label>
      <div class="form-actions">
        <button type="submit" class="primary-btn">Crear ticket</button>
      </div>
    </form>
  `;

  toggleModal(true, 'create');
}

async function openTicket(ticketId) {
  const response = await fetch(`/api/tickets/${ticketId}`);
  if (!response.ok) return;
  const ticket = await response.json();
  state.currentTicketId = Number(ticketId);

  const modal = document.getElementById('ticketModal');
  toggleModal(true, 'detail');

  const user = state.users.find((entry) => entry.id === Number(state.selectedUserId));
  const showAssignment = user && ['supervisor', 'administrador', 'técnico'].includes(user.role.toLowerCase());

  let actionControls = '';
  if (showAssignment) {
    const technicians = state.users.filter((entry) => entry.role.toLowerCase() === 'técnico');
    actionControls = `
      <div class="inline-actions">
        <label>
          Estado
          <select id="ticketStatus">
            <option ${ticket.status === 'Nuevo' ? 'selected' : ''}>Nuevo</option>
            <option ${ticket.status === 'Asignado' ? 'selected' : ''}>Asignado</option>
            <option ${ticket.status === 'En progreso' ? 'selected' : ''}>En progreso</option>
            <option ${ticket.status === 'Esperando usuario' ? 'selected' : ''}>Esperando usuario</option>
            <option ${ticket.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
            <option ${ticket.status === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
          </select>
        </label>
        <label>
          Prioridad
          <select id="ticketPriorityModal">
            <option ${ticket.priority === 'Baja' ? 'selected' : ''}>Baja</option>
            <option ${ticket.priority === 'Media' ? 'selected' : ''}>Media</option>
            <option ${ticket.priority === 'Alta' ? 'selected' : ''}>Alta</option>
            <option ${ticket.priority === 'Urgente' ? 'selected' : ''}>Urgente</option>
          </select>
        </label>
        <label>
          Asignar a
          <select id="ticketAssignee">
            <option value="">Sin asignar</option>
            ${technicians.map((technician) => `<option value="${technician.id}" ${ticket.assigned_to_id === technician.id ? 'selected' : ''}>${technician.full_name}</option>`).join('')}
          </select>
        </label>
      </div>
    `;
  }

  document.getElementById('modalBody').innerHTML = `
    <div class="meta-grid">
      <div class="detail-box">
        <h4>Información general</h4>
        <p><strong>Código:</strong> ${ticket.code}</p>
        <p><strong>Título:</strong> ${ticket.title}</p>
        <p><strong>Categoría:</strong> ${ticket.category}</p>
        <p><strong>Canal:</strong> ${ticket.channel}</p>
      </div>
      <div class="detail-box">
        <h4>Estado y prioridad</h4>
        <p><strong>Estado:</strong> <span class="badge ${template.statusClass(ticket.status)}">${ticket.status}</span></p>
        <p><strong>Prioridad:</strong> <span class="badge ${template.priorityClass(ticket.priority)}">${ticket.priority}</span></p>
        <p><strong>Solicitante:</strong> ${ticket.requester_name}</p>
        <p><strong>Asignado:</strong> ${ticket.assigned_to_name || 'Sin asignar'}</p>
      </div>
    </div>

    <div class="detail-box">
      <h4>Descripción</h4>
      <p>${ticket.description}</p>
    </div>

    <div class="detail-box">
      <h4>Solución / cierre</h4>
      <p>${ticket.solution || 'Sin solución registrada todavía.'}</p>
      <p>${ticket.closure_note || 'Sin nota de cierre.'}</p>
    </div>

    ${actionControls}

    <div class="detail-box">
      <h4>Actualizar comentarios</h4>
      <textarea id="updateNote" placeholder="Escriba los detalles de la actualización o solución..."></textarea>
      <div class="inline-actions">
        <button class="primary-btn" id="saveTicketUpdate">Guardar cambios</button>
      </div>
    </div>

    <div class="detail-box">
      <h4>Historial</h4>
      <ul class="history-list">
        ${(ticket.history || []).map((entry) => `
          <li><strong>${entry.actor_name}</strong> • ${entry.event}<br><small>${entry.details}</small></li>
        `).join('') || '<li>Sin historial registrado.</li>'}
      </ul>
    </div>
  `;

  document.getElementById('saveTicketUpdate').addEventListener('click', handleUpdateTicket);
}

async function handleUpdateTicket() {
  const status = document.getElementById('ticketStatus')?.value || null;
  const priority = document.getElementById('ticketPriorityModal')?.value || null;
  const assignedToId = document.getElementById('ticketAssignee')?.value || null;
  const notes = document.getElementById('updateNote')?.value || null;
  const payload = {
    status,
    priority,
    assigned_to_id: assignedToId ? Number(assignedToId) : null,
    solution: notes && (status === 'Resuelto' || status === 'Cerrado') ? notes : null,
    closure_note: status === 'Cerrado' ? notes || 'Ticket cerrado' : null,
    notes,
  };

  const response = await fetch(`/api/tickets/${state.currentTicketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    closeModal();
    await loadTickets();
  } else {
    alert('No se pudo actualizar el ticket');
  }
}

function closeModal() {
  toggleModal(false);
}

function openKnowledgeModal() {
  const modal = document.getElementById('knowledgeModal');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeKnowledgeModal() {
  const modal = document.getElementById('knowledgeModal');
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('closeKnowledgeModal').addEventListener('click', closeKnowledgeModal);
document.getElementById('newTicketButton').addEventListener('click', openNewTicketModal);
document.getElementById('newKnowledgeButton').addEventListener('click', openKnowledgeModal);

const ticketModal = document.getElementById('ticketModal');
ticketModal.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id !== 'newTicketModalForm') return;
  event.preventDefault();

  const payload = {
    title: form.elements.title.value.trim(),
    description: form.elements.description.value.trim(),
    category: form.elements.category.value,
    channel: form.elements.channel.value,
    priority: form.elements.priority.value,
  };

  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    alert('No se pudo crear el ticket');
    return;
  }

  closeModal();
  await loadTickets();
  document.querySelector('[data-section="tickets"]').click();
});

document.getElementById('newKnowledgeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;

  const payload = {
    title: form.elements.title.value.trim(),
    category: form.elements.category.value.trim() || 'General',
    summary: form.elements.summary.value.trim(),
    steps: form.elements.steps.value.trim(),
    tags: form.elements.tags.value.trim(),
  };

  const response = await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    alert(errorData.detail || 'No se pudo guardar la solución');
    return;
  }

  closeKnowledgeModal();
  form.reset();
  await loadKnowledge();
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.getElementById('loginError');
  error.hidden = true;
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('loginUsername').value.trim(),
      password: document.getElementById('loginPassword').value,
    }),
  });
  if (response.status === 401) {
    showLoginError('Usuario o contraseña incorrectos.');
    return;
  }
  if (!response.ok) {
    showLoginError('No se pudo iniciar sesión. Inténtalo de nuevo.');
    return;
  }
  try {
    await enterApplication(await response.json());
    document.getElementById('loginForm').reset();
  } catch (loginError) {
    showLoginError(loginError.message);
  }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  const response = await fetch('/api/logout', { method: 'POST' });
  if (!response.ok) throw new Error('No se pudo cerrar la sesión.');
  state.currentUser = null;
  state.selectedUserId = null;
  showAuthenticatedView(false);
});

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    const target = document.getElementById(button.dataset.section);
    target.classList.add('active');
    document.getElementById('pageTitle').textContent = button.textContent.trim();
  });
});

async function initialize() {
  const response = await fetch('/api/me');
  if (response.status === 401) {
    showAuthenticatedView(false);
    return;
  }
  if (!response.ok) throw new Error('No se pudo verificar la sesión.');
  await enterApplication(await response.json());
}

initialize();
