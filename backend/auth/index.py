"""Регистрация и авторизация пользователей чата."""
import json
import os
import hashlib
import secrets
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

AVATAR_COLORS = [
    'from-purple-500 to-pink-500',
    'from-green-500 to-blue-500',
    'from-blue-500 to-purple-500',
    'from-orange-500 to-red-500',
    'from-teal-500 to-cyan-500',
    'from-yellow-500 to-orange-500',
]


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    path = event.get('path', '/')
    body = json.loads(event.get('body') or '{}')
    action = body.get('action')

    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'register':
            username = body.get('username', '').strip()
            password = body.get('password', '')
            if not username or not password:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}
            if len(username) < 3:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Имя минимум 3 символа'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

            import random
            color = random.choice(AVATAR_COLORS)
            cur.execute(
                "INSERT INTO users (username, password_hash, avatar_color) VALUES (%s, %s, %s) RETURNING id, username, avatar_color",
                (username, hash_password(password), color)
            )
            user = cur.fetchone()
            if not user:
                conn.rollback()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пользователь уже существует'})}

            session_id = secrets.token_hex(32)
            cur.execute(
                "INSERT INTO sessions (id, user_id) VALUES (%s, %s)",
                (session_id, user[0])
            )
            conn.commit()
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({
                    'session_id': session_id,
                    'user': {'id': user[0], 'username': user[1], 'avatar_color': user[2]}
                })
            }

        elif action == 'login':
            username = body.get('username', '').strip()
            password = body.get('password', '')
            cur.execute(
                "SELECT id, username, avatar_color FROM users WHERE username = %s AND password_hash = %s",
                (username, hash_password(password))
            )
            user = cur.fetchone()
            if not user:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверное имя или пароль'})}

            session_id = secrets.token_hex(32)
            cur.execute("INSERT INTO sessions (id, user_id) VALUES (%s, %s)", (session_id, user[0]))
            conn.commit()
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({
                    'session_id': session_id,
                    'user': {'id': user[0], 'username': user[1], 'avatar_color': user[2]}
                })
            }

        elif action == 'me':
            session_id = event.get('headers', {}).get('x-session-id') or event.get('headers', {}).get('X-Session-Id')
            if not session_id:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
            cur.execute(
                "SELECT u.id, u.username, u.avatar_color FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.id = %s AND s.expires_at > NOW()",
                (session_id,)
            )
            user = cur.fetchone()
            if not user:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Сессия истекла'})}
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'user': {'id': user[0], 'username': user[1], 'avatar_color': user[2]}})
            }

        elif action == 'logout':
            session_id = event.get('headers', {}).get('x-session-id') or event.get('headers', {}).get('X-Session-Id')
            if session_id:
                cur.execute("DELETE FROM sessions WHERE id = %s", (session_id,))
                conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неизвестное действие'})}

    except psycopg2.IntegrityError:
        conn.rollback()
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пользователь уже существует'})}
    finally:
        cur.close()
        conn.close()
