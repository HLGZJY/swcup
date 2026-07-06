"""Test helpers: generate tokens, run scenarios S1-S10"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, r'F:\swcup2026\backend')
from test_ids import (
    A1, A2, A3, A4, A5, A6, A7, A8, A9, A10,
    USER1, USER2, USER3, USER4, USER5, ADMIN,
    NOSE_A1, NOSE_A3, NOSE_A4, NOSE_A5, NOSE_A7, NOSE_A8, NOSE_A9, NOSE_A10,
    LOC_A1, LOC_A2, LOC_A3, LOC_A4, LOC_A5, LOC_A6, LOC_A7, LOC_A8, LOC_A9, LOC_A10,
)

BE = 'http://localhost:3000'
TEST_DIR = r'F:\swcup2026\test_data\测试批'
JWT_SECRET = 'swcup2026_nose_rescue_jwt_secret_key'


def get_token(user_id: str, role: str = 'user') -> str:
    """Generate JWT for given user_id/role"""
    node_script = (
        "const jwt = require('jsonwebtoken');"
        f"console.log(jwt.sign({{ user_id: '{user_id}', role: '{role}' }}, '{JWT_SECRET}', {{ expiresIn: '7d' }}));"
    )
    return subprocess.check_output(
        ['node', '-e', node_script],
        cwd='F:\\swcup2026\\backend'
    ).decode().strip()


TOKENS = {
    'user1': get_token(USER1, 'user'),
    'user2': get_token(USER2, 'user'),
    'user3': get_token(USER3, 'user'),
    'user4': get_token(USER4, 'user'),
    'user5': get_token(USER5, 'user'),
    'admin': get_token(ADMIN, 'admin'),
}


def http(method: str, path: str, payload=None, token: str = None):
    """HTTP helper, returns (status, json)"""
    url = BE + path
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8', errors='replace'))


def upload_nose(nose_filename: str, token: str, lat=None, lng=None) -> str:
    """Upload nose image, returns vector_id"""
    img_path = os.path.join(TEST_DIR, nose_filename)
    with open(img_path, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode()
    if lat is None:
        lat = LOC_A1[0]
        lng = LOC_A1[1]
    payload = {
        'nose_photo': img_b64,
        'location_lat': lat,
        'location_lng': lng,
        'description': f'pre-record {nose_filename}',
    }
    code, resp = http('POST', '/v1/nose/collect', payload, token)
    if code == 201 and resp.get('code') == 0:
        return resp['data']['vector_id']
    raise RuntimeError(f"upload {nose_filename} failed: code={code} resp={resp}")


if __name__ == '__main__':
    # Sanity check
    print("Tokens generated:")
    for k, v in TOKENS.items():
        print(f"  {k}: ...{v[-20:]}")
    code, resp = http('GET', '/v1/animals', token=TOKENS['user1'])
    print(f"\nGET /v1/animals -> {code}, total={resp.get('data', {}).get('total')}")