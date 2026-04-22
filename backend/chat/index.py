"""Получение и отправка сообщений в чате."""
import json
import os
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_user_by_session(cur, session_id):
    cur.execute(
        "SELECT u.id, u.username, u.avatar_color FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.id = %s AND s.expires_at > NOW()",
        (session_id,)
    )
    return cur.fetchone()


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    session_id = event.get('headers', {}).get('x-session-id') or event.get('headers', {}).get('X-Session-Id')
    method = event.get('httpMethod', 'GET')

    conn = get_conn()
    cur = conn.cursor()

    try:
        user = get_user_by_session(cur, session_id) if session_id else None

        if method == 'GET':
            # Получить каналы и сообщения
            params = event.get('queryStringParameters') or {}
            channel_name = params.get('channel', 'общий')

            cur.execute("SELECT id, name FROM channels WHERE type = 'text' ORDER BY id")
            channels = [{'id': r[0], 'name': r[1]} for r in cur.fetchall()]

            cur.execute("SELECT id FROM channels WHERE name = %s", (channel_name,))
            ch = cur.fetchone()
            messages = []
            if ch:
                cur.execute(
                    """SELECT m.id, m.content, m.created_at, u.username, u.avatar_color
                       FROM messages m JOIN users u ON u.id = m.user_id
                       WHERE m.channel_id = %s
                       ORDER BY m.created_at DESC LIMIT 50""",
                    (ch[0],)
                )
                rows = cur.fetchall()
                messages = [
                    {
                        'id': r[0],
                        'content': r[1],
                        'created_at': r[2].strftime('%H:%M'),
                        'username': r[3],
                        'avatar_color': r[4],
                    }
                    for r in reversed(rows)
                ]

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'channels': channels, 'messages': messages})
            }

        elif method == 'POST':
            if not user:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            body = json.loads(event.get('body') or '{}')
            content = body.get('content', '').strip()
            channel_name = body.get('channel', 'общий')

            if not content:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пустое сообщение'})}
            if len(content) > 2000:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Сообщение слишком длинное'})}

            cur.execute("SELECT id FROM channels WHERE name = %s", (channel_name,))
            ch = cur.fetchone()
            if not ch:
                return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Канал не найден'})}

            cur.execute(
                "INSERT INTO messages (channel_id, user_id, content) VALUES (%s, %s, %s) RETURNING id, created_at",
                (ch[0], user[0], content)
            )
            msg = cur.fetchone()
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({
                    'id': msg[0],
                    'content': content,
                    'created_at': msg[1].strftime('%H:%M'),
                    'username': user[1],
                    'avatar_color': user[2],
                })
            }

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Метод не поддерживается'})}

    finally:
        cur.close()
        conn.close()
