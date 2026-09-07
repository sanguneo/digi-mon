"""Reopen the delivered editable blend and check its mesh data, without images."""
from pathlib import Path
import json
import bpy
import bmesh
from mathutils import Matrix

HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'props-english.blend'))
expected = set(json.loads((HERE / 'baseline-bounds.json').read_text())['bounds'])
root = bpy.data.objects['english-props']
assert {obj.name for obj in root.children} == expected, 'Direct child IDs'
assert len(bpy.data.objects) == 9, 'Object count'
assert len(bpy.data.materials) == 3, 'Material count'
assert len(bpy.data.meshes) == 8, 'Mesh count'
assert root.matrix_local == Matrix.Identity(4), 'Root identity'
for kind in ('cameras', 'lights', 'images', 'actions'):
    assert len(getattr(bpy.data, kind)) == 0, f'Unexpected {kind}'
result = {}
for obj in root.children:
    assert obj.type == 'MESH' and obj.matrix_local == Matrix.Identity(4), obj.name
    assert len(obj.data.materials) == 1 and len(obj.data.uv_layers) == 1, obj.name
    assert len(obj.data.color_attributes) == 1, obj.name
    color = obj.data.color_attributes['Color']
    assert color.domain == 'POINT' and len(color.data) == len(obj.data.vertices), obj.name
    material = obj.data.materials[0]
    principled = material.node_tree.nodes.get('Principled BSDF')
    assert principled is not None, material.name
    links = principled.inputs['Base Color'].links
    assert len(links) == 1 and links[0].from_node.layer_name == 'Color', material.name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    assert all(edge.is_manifold for edge in bm.edges), f'{obj.name}: open or nonmanifold edges'
    volume = bm.calc_volume(signed=True)
    assert volume > 0, f'{obj.name}: inward winding'
    result[obj.name] = {'triangles': len(obj.data.polygons),
                        'closed_manifold_edges': len(bm.edges), 'signed_volume': volume}
    bm.free()
report = {'status': 'pass', 'blender_version': bpy.app.version_string,
          'objects': 9, 'meshes': 8, 'materials': 3, 'forbidden_datablocks': [], 'parts': result}
(HERE / 'blend-validation-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('EDITABLE_BLEND_PASS ' + json.dumps(report))
