from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.notification import Notification
from app.schemas.collaboration import (
    TripMemberCreate,
    TripMemberUpdate,
    TripMemberResponse,
    InvitationResponse,
)
from app.api.deps import get_current_user
from app.api.permissions import require_owner

router = APIRouter(tags=["collaboration"])


@router.post(
    "/trips/{trip_id}/members",
    response_model=TripMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    trip_id: int,
    data: TripMemberCreate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    # Find invitee by email
    stmt = select(User).where(User.email == data.email)
    result = await db.execute(stmt)
    invitee = result.scalar_one_or_none()
    if not invitee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Check for duplicate
    stmt = select(TripMember).where(
        TripMember.trip_id == trip_id, TripMember.user_id == invitee.id
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already invited")

    member = TripMember(
        trip_id=trip_id,
        user_id=invitee.id,
        role=data.role,
        invited_by=user.id,
        status="pending",
    )
    db.add(member)
    await db.flush()
    await db.refresh(member)

    # Create notification for invitee (after flush so member.id is available)
    trip = await db.get(Trip, trip_id)
    notification = Notification(
        user_id=invitee.id,
        trip_id=trip_id,
        type="invitation",
        title="Trip invitation",
        message=f"{user.name or user.email} invited you to '{trip.name}'",
        data={"member_id": member.id, "role": data.role},
    )
    db.add(notification)
    await db.flush()

    return TripMemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        user_id=member.user_id,
        role=member.role,
        status=member.status,
        invited_by=member.invited_by,
        accepted_at=member.accepted_at,
        created_at=member.created_at,
        user_name=invitee.name,
        user_email=invitee.email,
        user_avatar=invitee.avatar_url,
    )


@router.get("/trips/{trip_id}/members", response_model=List[TripMemberResponse])
async def list_members(
    trip_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TripMember, User)
        .join(User, TripMember.user_id == User.id)
        .where(TripMember.trip_id == trip_id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        TripMemberResponse(
            id=member.id,
            trip_id=member.trip_id,
            user_id=member.user_id,
            role=member.role,
            status=member.status,
            invited_by=member.invited_by,
            accepted_at=member.accepted_at,
            created_at=member.created_at,
            user_name=u.name,
            user_email=u.email,
            user_avatar=u.avatar_url,
        )
        for member, u in rows
    ]


@router.patch("/trips/{trip_id}/members/{user_id}", response_model=TripMemberResponse)
async def update_member_role(
    trip_id: int,
    user_id: int,
    data: TripMemberUpdate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TripMember).where(
        TripMember.trip_id == trip_id, TripMember.user_id == user_id
    )
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    member.role = data.role
    await db.flush()
    await db.refresh(member)

    target_user = await db.get(User, user_id)
    return TripMemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        user_id=member.user_id,
        role=member.role,
        status=member.status,
        invited_by=member.invited_by,
        accepted_at=member.accepted_at,
        created_at=member.created_at,
        user_name=target_user.name if target_user else None,
        user_email=target_user.email if target_user else None,
        user_avatar=target_user.avatar_url if target_user else None,
    )


@router.delete("/trips/{trip_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    trip_id: int,
    user_id: int,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    if user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself as owner")

    stmt = select(TripMember).where(
        TripMember.trip_id == trip_id, TripMember.user_id == user_id
    )
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    await db.delete(member)
    await db.flush()


@router.post("/invitations/{member_id}/accept", response_model=TripMemberResponse)
async def accept_invitation(
    member_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TripMember).where(TripMember.id == member_id, TripMember.user_id == user.id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if member.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation already processed")

    member.status = "accepted"
    member.accepted_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(member)

    return TripMemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        user_id=member.user_id,
        role=member.role,
        status=member.status,
        invited_by=member.invited_by,
        accepted_at=member.accepted_at,
        created_at=member.created_at,
    )


@router.post("/invitations/{member_id}/reject", response_model=TripMemberResponse)
async def reject_invitation(
    member_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TripMember).where(TripMember.id == member_id, TripMember.user_id == user.id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if member.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation already processed")

    member.status = "rejected"
    await db.flush()
    await db.refresh(member)

    return TripMemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        user_id=member.user_id,
        role=member.role,
        status=member.status,
        invited_by=member.invited_by,
        accepted_at=member.accepted_at,
        created_at=member.created_at,
    )


@router.get("/invitations/pending", response_model=List[InvitationResponse])
async def get_pending_invitations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TripMember, Trip, User)
        .join(Trip, TripMember.trip_id == Trip.id)
        .outerjoin(User, TripMember.invited_by == User.id)
        .where(TripMember.user_id == user.id, TripMember.status == "pending")
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        InvitationResponse(
            id=member.id,
            trip_id=member.trip_id,
            trip_name=trip.name,
            role=member.role,
            status=member.status,
            invited_by_name=inviter.name if inviter else None,
            created_at=member.created_at,
        )
        for member, trip, inviter in rows
    ]
