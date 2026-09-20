"""Dependency-free smoke tests for the attendance math used by NoteDown."""
import math

def distance_m(lat1, lon1, lat2, lon2):
    r=6371000.0; p1=math.radians(lat1); p2=math.radians(lat2); dp=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.atan2(math.sqrt(a),math.sqrt(1-a))

def bunk(present, total, missed): return present*100/(total+missed)
def safe_bunks(present,total,target): return max(0,math.floor((100*present-target*total)/target))
def required_classes(present,total,target): return max(0,math.ceil((target*total-present*100)/(100-target))) if target < 100 else 0

assert round(bunk(18,20,2),1)==81.8
assert safe_bunks(18,20,75)==4
assert required_classes(14,20,75)==4
assert distance_m(14.0,79.0,14.0,79.0)==0
assert distance_m(14.0,79.0,14.001,79.0)>100
print("Attendance math smoke tests: PASS")
