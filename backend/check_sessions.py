import sys
sys.path.insert(0, 'src')
from src.core.config import settings
from appwrite.client import Client
from appwrite.services.users import Users

c = Client()
c.set_endpoint(settings.APPWRITE_ENDPOINT)
c.set_project(settings.APPWRITE_PROJECT_ID)
c.set_key(settings.APPWRITE_API_KEY)
u = Users(c)
result = u.list()
user = result['users'][0]
uid = user['$id']
print('User ID:', uid)
print('User name:', user['name'])

sessions = u.list_sessions(uid)
print('Active sessions:', sessions['total'])
for s in sessions['sessions'][:5]:
    sid = s['$id']
    print(' session:', sid[:15], '... provider:', s.get('provider','?'), 'expire:', str(s.get('expire','?'))[:25])
