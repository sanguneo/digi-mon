"""Optional, isolated Cycles review of exported bytes; never saves a model scene.

Run in background Blender. Only the requested PNG is written; previews/cameras/
lights do not enter the editable source or the shipped GLB.
"""
import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=HERE / '../../public/models/puppy.glb')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--view', choices=['front', 'three-quarter', 'feeding'], default='three-quarter')
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--size', type=int, default=640)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.samples < 1 or args.size < 128:
        parser.error('samples must be positive and size at least 128')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
    root = bpy.data.objects['puppy-asset']
    if args.view == 'feeding':
        original = list(root.children_recursive)
        # Exact scale-dependent lowering and maximum tilt from garden-models.ts.
        # World translation is omitted so growth stages remain side by side.
        for stage, scale in enumerate([.7, .9, 1.08, 1.2]):
            if stage == 0:
                actor, children = root, original
            else:
                actor = root.copy()
                bpy.context.collection.objects.link(actor)
                mapping = {root: actor}
                for source in original:
                    copy = source.copy()
                    bpy.context.collection.objects.link(copy)
                    mapping[source] = copy
                for source in original:
                    mapping[source].parent = mapping[source.parent]
                children = [mapping[source] for source in original]
            actor.location.x = (stage - 1.5) * 3.7
            actor.scale = (scale, scale, scale)
            actor.rotation_mode = 'XYZ'
            actor.rotation_euler.z = -.40
            for child in children:
                name = child.name.split('.')[0]
                if name == 'head':
                    child.location.z = .36 / scale + .62
                    child.rotation_mode = 'XYZ'
                    child.rotation_euler.x = .695
                if name in ('growth-collar', 'growth-bandana'):
                    hidden = stage < (1 if name == 'growth-collar' else 2)
                    child.hide_render = hidden
                    for part in child.children_recursive:
                        part.hide_render = hidden
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.samples
    # Distribution builds may omit OpenImageDenoise; use actual path-traced pixels.
    scene.cycles.use_denoising = False
    scene.render.resolution_x = args.size * 3 if args.view == 'feeding' else args.size
    scene.render.resolution_y = args.size
    scene.render.resolution_percentage = 100
    world = scene.world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.68, .72, .80, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
    floor = bpy.data.materials.new('Review floor — not exported')
    floor.diffuse_color = (.22, .29, .24, 1)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.012))
    bpy.context.object.data.materials.append(floor)
    lights = [('key', (-3, -4, 6), 550, 4, (1, .88, .72)),
              ('fill', (4, -2, 3), 220, 5, (.74, .86, 1)),
              ('rim', (2, 3, 5), 600, 3, (1, .97, .86))]
    for name, pos, energy, size, color in lights:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.size, light.shape, light.color = energy, size, 'DISK', color
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = pos
        aim(obj, (0, 0, 1.2))
    camera = bpy.data.cameras.new('Review camera — not exported')
    obj = bpy.data.objects.new('Review camera — not exported', camera)
    scene.collection.objects.link(obj)
    obj.location = ((0, -14, 5) if args.view == 'feeding' else
                    (0, -7, 2.55) if args.view == 'front' else (3.5, -6, 3.15))
    aim(obj, (0, -.04, 1.15))
    camera.type = 'ORTHO'
    camera.ortho_scale = 15.4 if args.view == 'feeding' else 3.35
    scene.camera = obj
    scene.view_settings.view_transform = 'AgX'
    scene.render.image_settings.file_format = 'PNG'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(args.output.resolve())
    bpy.ops.render.render(write_still=True)
    assert args.output.is_file(), 'Render did not produce the requested PNG'


if __name__ == '__main__':
    main()
