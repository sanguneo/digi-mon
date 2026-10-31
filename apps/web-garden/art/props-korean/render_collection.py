"""Matched Cycles contact sheet of every actual exported Korean prop.

blender -b --factory-startup --python render_collection.py -- source.glb output.png
Preview-only objects never enter the asset source or the runtime GLB.
"""
import math
import sys
import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector

IDS = ('moon-chair', 'dandelion-pot', 'tiny-pond', 'cloud-balloon', 'reading-cat',
       'rainbow-flag', 'picnic-basket', 'strawberry-patch', 'mushroom-home',
       'bird-bath', 'pebble-fountain', 'firefly-lantern', 'watering-can', 'sunlight-token')

args = sys.argv[sys.argv.index('--') + 1:]
source, output = Path(args[0]).resolve(), Path(args[1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
bpy.context.view_layer.update()
for index, name in enumerate(IDS):
    part = bpy.data.objects[name]
    nodes = [part, *part.children_recursive]
    meshes = [node for node in nodes if node.type == 'MESH']
    points = [node.matrix_world @ v.co for node in meshes for v in node.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (low + high) * .5
    factor = 1.65 / max(high - low)
    holder = bpy.data.objects.new('Preview tile ' + name, None)
    bpy.context.collection.objects.link(holder)
    holder.location = ((index % 4 - 1.5) * 2.5, 0, (1.5 - index // 4) * 2.5)
    holder.rotation_euler = (math.radians(15), 0, math.radians(-18))
    holder.scale = (factor,) * 3
    for mesh in meshes:
        world = mesh.matrix_world.copy()
        mesh.parent = holder
        mesh.matrix_local = world
        mesh.location -= center
    text_curve = bpy.data.curves.new(name + ' label', 'FONT')
    text_curve.body = name
    text_curve.align_x = 'CENTER'
    text_curve.size = .14
    label = bpy.data.objects.new(name + ' label', text_curve)
    bpy.context.collection.objects.link(label)
    label.location = ((index % 4 - 1.5) * 2.5, -.9, (1.5 - index // 4) * 2.5 - 1.0)
    label.rotation_euler = (math.pi / 2, 0, 0)
    material = bpy.data.materials.get('Label ink') or bpy.data.materials.new('Label ink')
    material.diffuse_color = (.09, .13, .11, 1)
    text_curve.materials.append(material)
for name in IDS:
    original = bpy.data.objects.get(name)
    if original:
        bpy.data.objects.remove(original, do_unlink=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = False
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('Warm studio world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.79, .82, .78, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .55
for name, position, power, size, color in (
    ('Large warm key', (-6, -10, 10), 1500, 8, (1, .91, .79)),
    ('Cool fill', (7, -6, 3), 1000, 7, (.76, .88, 1)),
    ('Soft rim', (2, 5, 8), 1800, 6, (1, .96, .88)),
):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = power, 'DISK', size, color
    lamp = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(lamp)
    lamp.location = position
    lamp.rotation_euler = (-lamp.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(0, -30, 0))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 10.6
scene.camera = camera
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
output.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(output)
bpy.ops.render.render(write_still=True)
output.with_suffix('.json').write_text(json.dumps({
    'source_glb': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'preview': str(output), 'renderer': 'Blender Cycles', 'blender': bpy.app.version_string,
    'resolution': [1600, 1600], 'samples': 48, 'denoising': False,
    'view_transform': 'AgX', 'look': 'AgX - Medium High Contrast',
    'all_parts': list(IDS), 'actual_exported_geometry': True, 'browser_screenshot': False,
}, indent=2) + '\n', encoding='utf-8')
print('COLLECTION_RENDER', output, flush=True)
