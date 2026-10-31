import bpy,hashlib,struct,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
def digest(path):
 bpy.ops.wm.open_mainfile(filepath=str(path)); out={}
 for obj in bpy.data.objects:
  if obj.type!='MESH':continue
  h=hashlib.sha256()
  for row in obj.matrix_local:
   h.update(struct.pack('<4f',*row))
  for v in obj.data.vertices:h.update(struct.pack('<3f',*v.co))
  for p in obj.data.polygons:h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
  out[obj.name]=h.hexdigest()
 return out
a=digest(root/'tree-v2/tree.blend');b=digest(root/'tree-v3/tree.blend');assert a==b,[(k,a.get(k),b.get(k)) for k in a.keys()|b.keys() if a.get(k)!=b.get(k)]
report={'status':'PASS','editable_meshes':len(a),'vertices_topology_local_transforms_bit_identical':True,'meshes':a};(root/'tree-v3/blend-color-preservation-report.json').write_text(json.dumps(report,indent=2)+'\n');print('EXACT EDITABLE GEOMETRY PASS',len(a))
