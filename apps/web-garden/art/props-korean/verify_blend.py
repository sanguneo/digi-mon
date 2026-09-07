"""Open the editable blend in background Blender; inspect source data only."""
from pathlib import Path
import json
import bpy

HERE=Path(__file__).resolve().parent
baseline=json.loads((HERE/'baseline-bounds.json').read_text())['bounds']
export=json.loads((HERE/'asset-report.json').read_text())
assert Path(bpy.data.filepath).resolve()==(HERE/'props-korean.blend').resolve()
root=bpy.data.objects['korean-props']
assert root.type=='EMPTY' and root.parent is None
assert {ob.name for ob in root.children}==set(baseline)
assert len(bpy.data.materials)==2
assert len(bpy.data.images)==len(bpy.data.cameras)==len(bpy.data.lights)==len(bpy.data.actions)==0
for mat in bpy.data.materials:
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    assert bsdf and list(bsdf.inputs['Base Color'].default_value)==[1,1,1,1]
    links=bsdf.inputs['Base Color'].links
    assert len(links)==1 and links[0].from_node.bl_idname=='ShaderNodeVertexColor'
    assert links[0].from_node.layer_name=='Color'
parts={}
for ob in bpy.data.objects:
    assert ob.type in ('EMPTY','MESH') and not ob.animation_data
    assert max(abs(ob.matrix_world[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4))<1e-7
for part,target in baseline.items():
    group=bpy.data.objects[part]
    assert group.parent==root and group.type=='EMPTY'
    assert len(group.children)==len(export['parts'][part]['features'])
    points=[]; triangles=0
    for ob in group.children:
        assert ob.type=='MESH' and len(ob.modifiers)==0
        data=ob.data
        assert data.color_attributes.active_color.name=='Color'
        assert len(data.color_attributes.active_color.data)==len(data.loops)
        assert len(data.uv_layers.active.data)==len(data.loops)
        assert all(len(poly.vertices)==3 for poly in data.polygons)
        triangles+=len(data.polygons)
        points.extend((v.co.x,v.co.z,-v.co.y) for v in data.vertices)
    low=[min(v[i] for v in points) for i in range(3)]
    high=[max(v[i] for v in points) for i in range(3)]
    error=max(abs(actual[i]-target[key][i]) for key,actual in (('min',low),('max',high)) for i in range(3))
    assert error<2e-6 and triangles==export['parts'][part]['triangles']
    parts[part]={'editable_features':len(group.children),'triangles':triangles,'bounds_error':error}
result={'status':'PASS','blender_version':bpy.app.version_string,'identity_groups':14,
    'editable_meshes':sum(p['editable_features'] for p in parts.values()),
    'triangles':sum(p['triangles'] for p in parts.values()),'materials':2,
    'images':0,'cameras':0,'lights':0,'animations':0,'parts':parts}
(HERE/'blend-report.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
