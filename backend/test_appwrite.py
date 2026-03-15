from src.appwrite_client import databases
from src.core.config import settings

try:
    result = databases.list_collections(settings.APPWRITE_DATABASE_ID)
    names = [c['$id'] for c in result['collections']]
    print('Collections found:', names)

    expected = {'users','user-api-keys','jobs','agent-runs','job-events'}
    missing = expected - set(names)

    if missing:
        print('MISSING collections:', missing)
        print('Create them in Appwrite Console first')
    else:
        print('PASS - all 5 collections exist')
except Exception as e:
    print('ERROR:', e)
