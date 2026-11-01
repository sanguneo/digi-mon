"""Independent exact-byte regression for the owner's color-only tree request."""
from pathlib import Path
import hashlib,json,struct
HERE=Path(__file__).resolve().parent
baseline=HERE/'tree-v2-geometry.glb';output=HERE.parent.parent/'public/models/tree.glb'
a=baseline.read_bytes();b=output.read_bytes();assert len(a)==len(b)
assert hashlib.sha256(a).hexdigest()=='556268ada2bb9c74afd06352bfded94c9981c26c27209afe6392f6cdbf88a0ba','Published v2 reference changed'
size=struct.unpack_from('<I',a,12)[0];data=json.loads(a[20:20+size]);start=28+size
assert a[:start]==b[:start],'GLB JSON, material, node or transform changed'
protected=bytearray(b);changed=0;seen=set()
for mesh in data['meshes']:
 for p in mesh['primitives']:
  index=p['attributes']['COLOR_0']
  if index in seen:continue
  seen.add(index);accessor=data['accessors'][index];view=data['bufferViews'][accessor['bufferView']]
  assert accessor['componentType']==5123 and accessor['type']=='VEC4'
  offset=start+view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',8)
  for i in range(accessor['count']):
   lo=offset+i*stride;hi=lo+8;changed+=a[lo:hi]!=b[lo:hi];protected[lo:hi]=a[lo:hi]
assert protected==a,'Non-color binary bytes changed'
assert changed>0,'No palette revision present'
print(json.dumps({'status':'PASS','changed_color_vertices':changed,'all_non_color_bytes_identical':True,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()},indent=2))
