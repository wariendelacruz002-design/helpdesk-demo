from __future__ import annotations

import os
import secrets
import time
from datetime import datetime
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./helpdesk_demo.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(30), nullable=False)
    department = Column(String(80), nullable=False)
    password = Column(String(100), nullable=False)

    tickets_created = relationship("Ticket", foreign_keys="Ticket.requested_by_id", back_populates="requester")
    tickets_assigned = relationship("Ticket", foreign_keys="Ticket.assigned_to_id", back_populates="assigned_to")
    history_entries = relationship("TicketHistory", back_populates="actor")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)
    channel = Column(String(40), nullable=False, default="WhatsApp")
    priority = Column(String(20), nullable=False, default="Media")
    status = Column(String(30), nullable=False, default="Nuevo")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    solution = Column(Text, nullable=True)
    closure_note = Column(Text, nullable=True)

    requester = relationship("User", foreign_keys=[requested_by_id], back_populates="tickets_created")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="tickets_assigned")
    history = relationship("TicketHistory", back_populates="ticket", cascade="all, delete-orphan")


class TicketHistory(Base):
    __tablename__ = "ticket_history"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event = Column(String(120), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="history")
    actor = relationship("User", back_populates="history_entries")


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(80), nullable=False, default="General")
    summary = Column(Text, nullable=False)
    steps = Column(Text, nullable=False)
    tags = Column(String(200), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User")


Base.metadata.create_all(bind=engine)


def seed_data() -> None:
    db = SessionLocal()
    try:
        existing_usernames = {user.username for user in db.query(User).all()}

        users = [
            User(username="admin", full_name="Admin Principal", role="administrador", department="TI", password="admin123"),
            User(username="cliente", full_name="Cliente Demo", role="cliente", department="Clientes", password="cliente123"),
            User(username="sup1", full_name="Ana López", role="supervisor", department="Soporte", password="sup123"),
            User(username="tec1", full_name="Carlos Ruiz", role="técnico", department="TI", password="tec123"),
            User(username="tec2", full_name="María Díaz", role="técnico", department="TI", password="tec456"),
            User(username="user1", full_name="José Pérez", role="solicitante", department="Producción", password="user123"),
            User(username="user2", full_name="Laura Gómez", role="solicitante", department="Logística", password="user456"),
        ]

        missing_users = [user for user in users if user.username not in existing_usernames]
        if missing_users:
            db.add_all(missing_users)
            db.commit()

        user_map = {user.username: user for user in db.query(User).all()}

        if db.query(Ticket).count() == 0:
            tickets = [
                Ticket(
                    code="TI-2026-001",
                    title="Impresora de planta no responde",
                    description="La impresora de la línea de producción no responde a las órdenes de impresión y presenta mensajes de papel atascado.",
                    category="Hardware",
                    channel="WhatsApp",
                    priority="Alta",
                    status="Asignado",
                    requested_by_id=user_map["user1"].id,
                    assigned_to_id=user_map["tec1"].id,
                    solution="Se desmontó el alimentador de papel y se limpió el rodillo. La impresora volvió a estar operativa.",
                    closure_note="Ticket cerrado tras validación del usuario.",
                ),
                Ticket(
                    code="TI-2026-002",
                    title="Falla del acceso al sistema ERP",
                    description="El usuario reporta que no puede entrar al sistema de producción y aparece un error de credenciales.",
                    category="Software",
                    channel="Llamada",
                    priority="Alta",
                    status="En progreso",
                    requested_by_id=user_map["user2"].id,
                    assigned_to_id=user_map["tec2"].id,
                    solution=None,
                    closure_note=None,
                ),
                Ticket(
                    code="TI-2026-003",
                    title="Monitor del área de calidad en pantalla azul",
                    description="El monitor de la estación de calidad se reinicia cada 15 minutos y aparece pantalla azul al iniciar aplicaciones.",
                    category="Hardware",
                    channel="Correo",
                    priority="Media",
                    status="Nuevo",
                    requested_by_id=user_map["user1"].id,
                    assigned_to_id=None,
                    solution=None,
                    closure_note=None,
                ),
                Ticket(
                    code="TI-2026-004",
                    title="Solicitud de cambio de contraseña",
                    description="Necesito restablecer la contraseña del usuario de la aplicación de inventarios para continuar con la operación.",
                    category="Acceso",
                    channel="Verbal",
                    priority="Baja",
                    status="Cerrado",
                    requested_by_id=user_map["user2"].id,
                    assigned_to_id=user_map["tec1"].id,
                    solution="Se realizó el restablecimiento y se verificó el acceso desde la estación asignada.",
                    closure_note="Solicitud atendida y confirmada por el usuario.",
                ),
            ]

            db.add_all(tickets)
            db.commit()

            for ticket in tickets:
                db.add(
                    TicketHistory(
                        ticket_id=ticket.id,
                        actor_id=ticket.requested_by_id,
                        event="Ticket registrado",
                        details="Reporte inicial del caso.",
                    )
                )
                if ticket.assigned_to_id:
                    db.add(
                        TicketHistory(
                            ticket_id=ticket.id,
                            actor_id=ticket.assigned_to_id,
                            event="Ticket asignado",
                            details=f"Asignado a {ticket.assigned_to.full_name if ticket.assigned_to else 'técnico'}.",
                        )
                    )

            db.commit()

        db.query(Ticket).filter(Ticket.priority == "Urgente").update(
            {Ticket.priority: "Alta"},
            synchronize_session=False,
        )
        db.commit()

        if db.query(KnowledgeArticle).count() == 0:
            admin_user = user_map.get("admin")
            if admin_user:
                article = KnowledgeArticle(
                    title="Cambiar la contraseña de acceso",
                    category="Acceso",
                    summary="Solución rápida para cambiar la contraseña del sistema y recuperar el acceso cuando la cuenta se bloquea o queda vencida.",
                    steps="1. Ingresar al sistema con la cuenta actual.\n2. Abrir el menú de perfil o configuración de cuenta.\n3. Seleccionar Cambiar contraseña.\n4. Escribir la contraseña actual y la nueva contraseña.\n5. Guardar cambios y confirmar el inicio de sesión con la nueva clave.",
                    tags="contraseña, acceso, seguridad",
                    created_by_id=admin_user.id,
                )
                db.add(article)
                db.commit()
    finally:
        db.close()


seed_data()


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=5)
    description: str = Field(..., min_length=10)
    category: str
    channel: str = "WhatsApp"
    priority: Literal["Baja", "Media", "Alta"] = "Media"


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[Literal["Baja", "Media", "Alta"]] = None
    assigned_to_id: Optional[int] = None
    solution: Optional[str] = None
    closure_note: Optional[str] = None
    notes: Optional[str] = None


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class KnowledgeCreate(BaseModel):
    title: str = Field(..., min_length=3)
    category: str = Field(default="General")
    summary: str = Field(..., min_length=10)
    steps: str = Field(..., min_length=10)
    tags: str | None = None


app = FastAPI(title="Help Desk Demo", version="1.0.0")
SESSION_MAX_AGE = 8 * 60 * 60
active_sessions: dict[str, tuple[int, float]] = {}


def user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "department": user.department,
    }


def get_current_user(request: Request) -> User:
    token = request.cookies.get("helpdesk_session")
    session = active_sessions.get(token) if token else None
    if not session or session[1] <= time.time():
        if token:
            active_sessions.pop(token, None)
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == session[0]).first()
        if not user:
            active_sessions.pop(token, None)
            raise HTTPException(status_code=401, detail="La sesión no es válida")
        return user
    finally:
        db.close()


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="helpdesk_session",
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "").lower() == "true",
        samesite="lax",
    )


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: LoginRequest, response: Response) -> dict:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == credentials.username).first()
        if not user or user.password != credentials.password:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
        profile = user_payload(user)
        user_id = user.id
    finally:
        db.close()

    token = secrets.token_urlsafe(32)
    now = time.time()
    for existing_token, (_, expires_at) in list(active_sessions.items()):
        if expires_at <= now:
            active_sessions.pop(existing_token, None)
    active_sessions[token] = (user_id, now + SESSION_MAX_AGE)
    set_session_cookie(response, token)
    return profile


@app.post("/api/logout")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get("helpdesk_session")
    if token:
        active_sessions.pop(token, None)
    response.delete_cookie(
        key="helpdesk_session",
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "").lower() == "true",
        samesite="lax",
    )
    return {"message": "Sesión cerrada"}


@app.get("/api/me")
def get_current_profile(current_user: User = Depends(get_current_user)) -> dict:
    return user_payload(current_user)


@app.get("/api/users")
def get_users(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        users = db.query(User).all()
        return [
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "role": u.role,
                "department": u.department,
            }
            for u in users
        ]
    finally:
        db.close()


@app.get("/api/knowledge")
def get_knowledge(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        articles = db.query(KnowledgeArticle).order_by(KnowledgeArticle.created_at.desc()).all()
        payload = [
            {
                "id": article.id,
                "title": article.title,
                "category": article.category,
                "summary": article.summary,
                "steps": article.steps,
                "tags": article.tags,
                "created_by": article.creator.full_name if article.creator else "Admin",
                "created_at": article.created_at.isoformat() if article.created_at else None,
            }
            for article in articles
        ]
        return payload
    finally:
        db.close()


@app.post("/api/knowledge")
def create_knowledge(article: KnowledgeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role.lower() not in {"administrador", "supervisor"}:
        raise HTTPException(status_code=403, detail="Solo administradores y supervisores pueden publicar soluciones")

    db = SessionLocal()
    try:
        new_article = KnowledgeArticle(
            title=article.title.strip(),
            category=article.category.strip() or "General",
            summary=article.summary.strip(),
            steps=article.steps.strip(),
            tags=article.tags.strip() if article.tags else None,
            created_by_id=current_user.id,
        )
        db.add(new_article)
        db.commit()
        db.refresh(new_article)
        return {
            "message": "Solución publicada",
            "id": new_article.id,
            "title": new_article.title,
        }
    finally:
        db.close()


@app.get("/api/tickets")
def get_tickets(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        query = db.query(Ticket)
        if current_user.role.lower() == "cliente":
            query = query.filter(Ticket.requested_by_id == current_user.id)
        tickets = query.order_by(Ticket.created_at.desc()).all()
        payload = []
        for ticket in tickets:
            history = [
                {
                    "id": item.id,
                    "event": item.event,
                    "details": item.details,
                    "created_at": item.created_at.isoformat(),
                    "actor_name": item.actor.full_name,
                }
                for item in ticket.history
            ]
            payload.append(
                {
                    "id": ticket.id,
                    "code": ticket.code,
                    "title": ticket.title,
                    "description": ticket.description,
                    "category": ticket.category,
                    "channel": ticket.channel,
                    "priority": ticket.priority,
                    "status": ticket.status,
                    "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
                    "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
                    "requested_by_id": ticket.requested_by_id,
                    "requester_name": ticket.requester.full_name if ticket.requester else "",
                    "assigned_to_id": ticket.assigned_to_id,
                    "assigned_to_name": ticket.assigned_to.full_name if ticket.assigned_to else None,
                    "solution": ticket.solution,
                    "closure_note": ticket.closure_note,
                    "history": history,
                }
            )
        return payload
    finally:
        db.close()


@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: int, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        if current_user.role.lower() == "cliente" and ticket.requested_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="No tienes permiso para ver este ticket")

        history = [
            {
                "id": item.id,
                "event": item.event,
                "details": item.details,
                "created_at": item.created_at.isoformat(),
                "actor_name": item.actor.full_name,
            }
            for item in ticket.history
        ]

        payload = {
            "id": ticket.id,
            "code": ticket.code,
            "title": ticket.title,
            "description": ticket.description,
            "category": ticket.category,
            "channel": ticket.channel,
            "priority": ticket.priority,
            "status": ticket.status,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "requested_by_id": ticket.requested_by_id,
            "requester_name": ticket.requester.full_name if ticket.requester else "",
            "assigned_to_id": ticket.assigned_to_id,
            "assigned_to_name": ticket.assigned_to.full_name if ticket.assigned_to else None,
            "solution": ticket.solution,
            "closure_note": ticket.closure_note,
            "history": history,
        }
        return payload
    finally:
        db.close()


@app.post("/api/tickets")
def create_ticket(ticket: TicketCreate, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        last_ticket = db.query(Ticket).order_by(Ticket.id.desc()).first()
        next_number = (last_ticket.id + 1) if last_ticket else 1
        ticket_code = f"TI-2026-{next_number:03d}"

        new_ticket = Ticket(
            code=ticket_code,
            title=ticket.title,
            description=ticket.description,
            category=ticket.category,
            channel=ticket.channel,
            priority=ticket.priority,
            status="Nuevo",
            requested_by_id=current_user.id,
        )
        db.add(new_ticket)
        db.commit()
        db.refresh(new_ticket)

        db.add(
            TicketHistory(
                ticket_id=new_ticket.id,
                actor_id=current_user.id,
                event="Ticket registrado",
                details="Ticket creado por el solicitante desde la interfaz del prototipo.",
            )
        )
        db.commit()
        return {"message": "Ticket creado", "ticket_id": new_ticket.id, "code": new_ticket.code}
    finally:
        db.close()


@app.patch("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: int, change: TicketUpdate, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        if current_user.role.lower() == "cliente":
            raise HTTPException(status_code=403, detail="El cliente no puede actualizar tickets de soporte")

        if change.status is not None:
            ticket.status = change.status
        if change.priority is not None:
            ticket.priority = change.priority
        if change.assigned_to_id is not None:
            ticket.assigned_to_id = change.assigned_to_id
        if change.solution is not None:
            ticket.solution = change.solution
        if change.closure_note is not None:
            ticket.closure_note = change.closure_note

        ticket.updated_at = datetime.utcnow()

        event_text = "Actualización del ticket"
        details = change.notes or "Se registró una actualización del caso."
        if change.status:
            event_text = f"Estado actualizado a {change.status}"
        if change.priority:
            event_text = f"Prioridad actualizada a {change.priority}"
        if change.assigned_to_id is not None:
            event_text = "Ticket reasignado"
        if change.solution:
            event_text = "Solución registrada"
        db.add(TicketHistory(ticket_id=ticket.id, actor_id=current_user.id, event=event_text, details=details))

        db.commit()
        return {"message": "Ticket actualizado"}
    finally:
        db.close()


app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/media", StaticFiles(directory="media"), name="media")


@app.get("/")
def read_index():
    return FileResponse("templates/index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
