"""Numerically validate the actual self-contained GLB using only Python stdlib.

No Blender viewport, preview, renderer, images, OCR, browser, or network involved.
Run: python validate_props_english.py
The builder writes the full report; this standalone command independently checks
the binary again and prints its measured summary without changing any files.
"""
from pathlib import Path
import hashlib
import json
import math
import struct

IDS = ('shell-arch', 'ribbon-kelp', 'coral-garden', 'bubble-rock',
       'treasure-chest', 'star-lamp', 'fish-food', 'bubble-trail')
TOLERANCE = 2e-6


def require(condition, message):
    if not condition:
        raise ValueError(message)


def bounds(points):
    low = [min(v[a] for v in points) for a in range(3)]
    high = [max(v[a] for v in points) for a in range(3)]
    return {'min': low, 'max': high, 'size': [high[a] - low[a] for a in range(3)],
            'center': [(low[a] + high[a]) / 2 for a in range(3)]}


def near(actual, expected, label):
    error = max(abs(a - b) for a, b in zip(actual, expected))
    require(error <= TOLERANCE, f'{label}: {actual} != {expected}; error {error}')
    return error


def components(positions, indices):
    # Weld only coincident export splits (UV seams), not nearby separate forms.
    parents = {}
    keys = [tuple(round(v, 7) for v in p) for p in positions]

    def root(a):
        parents.setdefault(a, a)
        while a != parents[a]:
            parents[a] = parents[parents[a]]
            a = parents[a]
        return a

    for i in range(0, len(indices), 3):
        a, b, c = [keys[indices[i + j]] for j in range(3)]
        ra, rb, rc = root(a), root(b), root(c)
        parents[rb] = ra
        parents[rc] = ra
    groups = {}
    for key, p in zip(keys, positions):
        groups.setdefault(root(key), []).append(p)
    return sorted([bounds(p) for p in groups.values()], key=lambda b: b['center'][1])


def validate(path, baseline_path):
    raw = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    require(magic == b'glTF' and version == 2 and length == len(raw), 'Invalid GLB header')
    require(len(raw) <= 3_000_000, f'GLB budget exceeded: {len(raw)} bytes')
    chunks, offset = [], 12
    while offset < length:
        size, kind = struct.unpack_from('<II', raw, offset)
        require(size % 4 == 0, 'Unaligned GLB chunk')
        chunks.append((kind, raw[offset + 8:offset + 8 + size]))
        offset += 8 + size
    require(offset == length and [c[0] for c in chunks] == [0x4E4F534A, 0x004E4942], 'Expected JSON + BIN only')
    doc, binary = json.loads(chunks[0][1]), chunks[1][1]
    require(doc['asset']['version'] == '2.0', 'Expected glTF 2.0')
    for key in ('images', 'textures', 'samplers', 'cameras', 'skins', 'animations'):
        require(not doc.get(key), f'Forbidden resource: {key}')
    require(not doc.get('extensionsUsed') and not doc.get('extensionsRequired'), 'Unexpected glTF extensions')
    require(len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0], 'External buffer')
    require(doc['buffers'][0]['byteLength'] <= len(binary), 'Truncated BIN')
    baseline = json.loads(Path(baseline_path).read_text())['bounds']
    nodes = doc['nodes']
    names = [n.get('name') for n in nodes]
    require(len(nodes) == 9 and set(names) == {'english-props', *IDS}, f'Unexpected nodes: {names}')
    root_index = names.index('english-props')
    root_node = nodes[root_index]
    require('mesh' not in root_node, 'Library root must be an empty')
    require({nodes[i]['name'] for i in root_node['children']} == set(IDS) and
            len(root_node['children']) == 8, 'Expected eight direct children')
    require(len(doc['scenes']) == 1 and doc['scenes'][0]['nodes'] == [root_index], 'Unexpected scene roots')
    identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    for node in nodes:
        near(node.get('translation', [0, 0, 0]), [0, 0, 0], node['name'] + ' translation')
        near(node.get('rotation', [0, 0, 0, 1]), [0, 0, 0, 1], node['name'] + ' rotation')
        near(node.get('scale', [1, 1, 1]), [1, 1, 1], node['name'] + ' scale')
        near(node.get('matrix', identity), identity, node['name'] + ' matrix')
        require(not node.get('extensions') and 'skin' not in node and 'camera' not in node, 'Unexpected node resources')
    materials = doc.get('materials', [])
    require(0 < len(materials) <= 3, 'Material role budget')
    for material in materials:
        pbr = material['pbrMetallicRoughness']
        near(pbr.get('baseColorFactor', [1, 1, 1, 1]), [1, 1, 1, 1], 'white base')
        require(material.get('alphaMode', 'OPAQUE') == 'OPAQUE', 'Transparent material')
        require(pbr.get('metallicFactor', 1) == 0, 'Unexpected metallic material')
        require(0 <= pbr.get('roughnessFactor', 1) <= 1, 'Roughness range')
        require(not material.get('extensions'), 'Unexpected material extensions')
        require('Texture' not in json.dumps(material), 'Texture reference')
    require(len(doc['meshes']) == 8, 'Expected exactly eight meshes')

    def accessor(index):
        acc = doc['accessors'][index]
        require('sparse' not in acc, 'Unexpected sparse accessor')
        view = doc['bufferViews'][acc['bufferView']]
        require(view.get('buffer', 0) == 0, 'External accessor buffer')
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[acc['type']]
        fmt, size = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}[acc['componentType']]
        stride = view.get('byteStride', size * width)
        start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        end = start + (acc['count'] - 1) * stride + width * size
        require(end <= view.get('byteOffset', 0) + view['byteLength'] <= len(binary), 'Accessor range')
        result = [struct.unpack_from('<' + fmt * width, binary, start + i * stride) for i in range(acc['count'])]
        if acc.get('normalized'):
            denominator = {5121: 255, 5123: 65535}[acc['componentType']]
            result = [tuple(v / denominator for v in row) for row in result]
        require(all(math.isfinite(v) for row in result for v in row), f'Nonfinite accessor {index}')
        return result

    # Read all accessors, including any not selected below, and reject NaN/Inf.
    for i in range(len(doc['accessors'])):
        accessor(i)
    report = {'status': 'pass', 'glb_bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
              'coordinates': 'Y-up, all node transforms identity, historic local origins',
              'root': 'english-props', 'bounds_tolerance': TOLERANCE,
              'materials': materials, 'triangles': 0, 'primitives': 0, 'parts': {},
              'forbidden_resources': [], 'visual_review': 'Not performed; no image operations authorized'}
    for name in IDS:
        node = nodes[names.index(name)]
        require(not node.get('children'), f'{name}: expected direct leaf mesh')
        mesh = doc['meshes'][node['mesh']]
        primitives = mesh['primitives']
        require(1 <= len(primitives) <= 3, f'{name}: primitive budget')
        positions, indices, vertex_offset = [], [], 0
        triangles, normal_error, min_uv_area, min_area = 0, 0, math.inf, math.inf
        uv_values, color_values = [], set()
        for primitive in primitives:
            require(primitive.get('mode', 4) == 4, f'{name}: not triangles')
            require(not primitive.get('targets'), 'Unexpected morph targets')
            attrs = primitive['attributes']
            require(set(attrs) == {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'}, f'{name}: attributes {attrs}')
            p, n, uv, color = [accessor(attrs[key]) for key in ('POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0')]
            require(len(p) == len(n) == len(uv) == len(color), f'{name}: attribute counts')
            require(all(len(v) == 3 for v in p + n) and all(len(v) == 2 for v in uv), 'Attribute dimensions')
            require(all(0 <= value <= 1 for row in color for value in row), 'Color range')
            require(all(len(row) == 3 or row[3] == 1 for row in color), 'Vertex alpha must be opaque')
            normal_error = max(normal_error, max(abs(math.sqrt(sum(v * v for v in row)) - 1) for row in n))
            require(normal_error <= 2e-5, f'{name}: non-unit normals {normal_error}')
            require(all(-1e-6 <= v <= 1.000001 for row in uv for v in row), f'{name}: UV range')
            uv_values.extend(uv)
            color_values.update(color)
            idx = [row[0] for row in accessor(primitive['indices'])]
            require(len(idx) % 3 == 0 and all(0 <= i < len(p) for i in idx), 'Invalid triangle indices')
            require(0 <= primitive['material'] < len(materials), 'Invalid material index')
            for i in range(0, len(idx), 3):
                a, b, c = [uv[idx[i + j]] for j in range(3)]
                uv_area = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
                min_uv_area = min(min_uv_area, uv_area)
                a, b, c = [p[idx[i + j]] for j in range(3)]
                u, v = [b[j] - a[j] for j in range(3)], [c[j] - a[j] for j in range(3)]
                cross = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
                min_area = min(min_area, math.sqrt(sum(x * x for x in cross)) / 2)
            positions.extend(p)
            indices.extend(i + vertex_offset for i in idx)
            vertex_offset += len(p)
            triangles += len(idx) // 3
        require(min_uv_area > 1e-12, f'{name}: degenerate UV triangle {min_uv_area}')
        require(min_area > 1e-14, f'{name}: degenerate geometric triangle {min_area}')
        require(len(color_values) > 1, f'{name}: missing authored vertex color variation')
        measured = bounds(positions)
        bounds_error = max(near(measured[key], baseline[name][key], f'{name} {key}') for key in ('min', 'max'))
        part = {'triangles': triangles, 'primitives': len(primitives), 'export_vertices': len(positions),
                'bounds': measured, 'max_baseline_bounds_error': bounds_error,
                'max_normal_length_error': normal_error, 'minimum_triangle_area': min_area,
                'minimum_uv_triangle_area': min_uv_area,
                'uv_min': [min(v[a] for v in uv_values) for a in range(2)],
                'uv_max': [max(v[a] for v in uv_values) for a in range(2)],
                'unique_vertex_colors': len(color_values)}
        if name in ('fish-food', 'bubble-trail'):
            groups = components(positions, indices)
            part['connected_component_bounds'] = groups
            if name == 'fish-food':
                require(len(groups) == 5, 'Fish food must contain five pellets')
                for i, group in enumerate(groups):
                    near(group['center'], [(i % 2 - .5) * .11, i * .085, 0], 'Pellet center')
                    near(group['size'], [.11, .11, .11], 'Pellet diameters')
            else:
                require(len(groups) == 10, 'Trail must contain five rings and five highlights')
                rings = [group for group in groups if group['size'][2] < .03]
                highlights = [group for group in groups if group['size'][2] >= .03]
                require(len(rings) == len(highlights) == 5, 'Trail form counts')
                for i, (ring, highlight) in enumerate(zip(rings, highlights)):
                    x, y, r = math.sin(i * 1.6) * .3, i * .3, .12 + i % 2 * .07
                    near(ring['center'], [x, y, 0], 'Bubble center')
                    near(ring['size'][:2], [2 * (r + .014)] * 2, 'Bubble outside diameters')
                    near(highlight['center'], [x - .055, y + .07, .02], 'Bubble highlight center')
        report['parts'][name] = part
        report['triangles'] += triangles
        report['primitives'] += len(primitives)
    require(report['triangles'] <= 30000, 'Total triangle budget')
    require(sum(p['triangles'] <= 3500 for p in report['parts'].values()) >= 5, 'Most parts must be <=3500 triangles')
    report['parts_within_3500_triangles'] = sum(p['triangles'] <= 3500 for p in report['parts'].values())
    return report


if __name__ == '__main__':
    here = Path(__file__).resolve().parent
    result = validate(here.parent.parent / 'public/models/props-english.glb', here / 'baseline-bounds.json')
    print(json.dumps(result, indent=2))
