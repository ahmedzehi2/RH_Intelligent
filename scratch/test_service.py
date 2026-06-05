import sys
import os
sys.path.append(os.getcwd())
from backend.services.mission_service import MissionService
import json

service = MissionService()
res = service.get_all_missions(11) # Assuming user_id 11 is RH
print(json.dumps(res, indent=2, default=str))
