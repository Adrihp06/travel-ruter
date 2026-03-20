from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.comment import Comment
from app.models.trip_member import TripMember
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse
from app.api.deps import get_current_user
from app.api.permissions import require_viewer

router = APIRouter(tags=["comments"])


def _build_thread(comments: list[Comment], user_map: dict) -> list[CommentResponse]:
    """Build threaded comment structure from flat list."""
    by_id = {}
    roots = []

    for c in comments:
        u = user_map.get(c.user_id, {})
        resp = CommentResponse(
            id=c.id,
            trip_id=c.trip_id,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            user_id=c.user_id,
            user_name=u.get("name"),
            user_avatar=u.get("avatar_url"),
            content=c.content,
            parent_id=c.parent_id,
            created_at=c.created_at,
            updated_at=c.updated_at,
            replies=[],
        )
        by_id[c.id] = resp

    for c in comments:
        resp = by_id[c.id]
        if c.parent_id and c.parent_id in by_id:
            by_id[c.parent_id].replies.append(resp)
        else:
            roots.append(resp)

    return roots


@router.get("/trips/{trip_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    trip_id: int,
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    user: User = Depends(require_viewer),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Comment)
        .where(
            Comment.trip_id == trip_id,
            Comment.entity_type == entity_type,
            Comment.entity_id == entity_id,
        )
        .order_by(Comment.created_at.asc())
    )
    result = await db.execute(stmt)
    comments = list(result.scalars().all())

    # Build user map
    user_ids = {c.user_id for c in comments}
    user_map = {}
    if user_ids:
        user_stmt = select(User).where(User.id.in_(user_ids))
        user_result = await db.execute(user_stmt)
        for u in user_result.scalars().all():
            user_map[u.id] = {"name": u.name, "avatar_url": u.avatar_url}

    return _build_thread(comments, user_map)


@router.post(
    "/trips/{trip_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    trip_id: int,
    data: CommentCreate,
    user: User = Depends(require_viewer),
    db: AsyncSession = Depends(get_db),
):
    comment = Comment(
        trip_id=trip_id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        user_id=user.id,
        content=data.content,
        parent_id=data.parent_id,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        trip_id=comment.trip_id,
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        user_id=comment.user_id,
        user_name=user.name,
        user_avatar=user.avatar_url,
        content=comment.content,
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.put("/trips/{trip_id}/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    trip_id: int,
    comment_id: int,
    data: CommentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Comment).where(Comment.id == comment_id, Comment.trip_id == trip_id)
    result = await db.execute(stmt)
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit others' comments")

    comment.content = data.content
    await db.flush()
    await db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        trip_id=comment.trip_id,
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        user_id=comment.user_id,
        user_name=user.name,
        user_avatar=user.avatar_url,
        content=comment.content,
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.delete("/trips/{trip_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    trip_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Comment).where(Comment.id == comment_id, Comment.trip_id == trip_id)
    result = await db.execute(stmt)
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    # Owner of comment or trip owner can delete
    if comment.user_id != user.id:
        # Check if user is trip owner
        member_stmt = select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.user_id == user.id,
            TripMember.role == "owner",
            TripMember.status == "accepted",
        )
        member_result = await db.execute(member_stmt)
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete others' comments")

    await db.delete(comment)
    await db.flush()
