const PieceType = {
    NONE  : 0,
    STICK : 1,
    BOX   : 2,
    JAY   : 3,
    ZEE   : 4,
    TEE   : 5,
    CHI   : 6,
    RAL   : 7,
    LEGS  : 8,
};

const colors = [
    new BABYLON.Color3(0.0, 0.0, 0.0),
    new BABYLON.Color3(1.0, 0.0, 0.0),
    new BABYLON.Color3(0.0, 1.0, 0.0),
    new BABYLON.Color3(0.0, 0.0, 1.0),
    new BABYLON.Color3(1.0, 1.0, 0.0),
    new BABYLON.Color3(1.0, 0.7, 0.0),
    new BABYLON.Color3(0.0, 1.0, 1.0),
    new BABYLON.Color3(1.0, 0.0, 1.0),
    new BABYLON.Color3(1.0, 1.0, 1.0),
];

class Grid {
    constructor(
        width,
        height,
        x_world,
        y_world,
        position,
        axis,
        piece_type_materials_map,
        scene)
    {
        this.width = width;
        this.height = height;
        this.cells = Array(width * height).fill(PieceType.NONE);
        this.piece_type_materials_map = piece_type_materials_map;

        this.squares = Array(width * height);
        for (let x = 0; x < width; ++x) {
            for (let y = 0; y < height; ++y) {
                let square = new BABYLON.MeshBuilder.CreatePlane(
                    "", { width: 1, height: 1}, scene);

                square.enableEdgesRendering(0.2);
                square.edgesWidth = 4.0;
                square.edgesColor = new BABYLON.Color4(0, 0, 0, 0.5);

                square.position =
                    x_world.scale(x).add(y_world.scale(y)).add(position);
                square.rotate(axis, Math.PI, BABYLON.Space.LOCAL);
                square.material = piece_type_materials_map[PieceType.NONE];
                this.squares[this.index(x, y)] = square;
            }
        }
    }

    index(col, row) {
        return row * this.width + col;
    }

    set_cell(index, piece_type) {
        this.cells[index] = piece_type;
        this.squares[index].material =
            this.piece_type_materials_map[piece_type];
    }

    set_cells(coords, piece_type) {
        coords.forEach(c => this.set_cell(this.index(c.x, c.y), piece_type));
    }

    row_full(row) {
        for (let x = 0; x < this.width; ++x) {
            if (this.cells[this.index(x, row)] == PieceType.NONE) {
                return false;
            }
        }
        return true;
    }

    clear_row(row) {
        // Drop all rows above by 1.
        for (let y = row + 1; y < this.height; ++y) {
            for (let x = 0; x < this.width; ++x) {
                this.set_cell(
                    this.index(x, y - 1),
                    this.cells[this.index(x, y)]);
                }
            }
        }

    clear_full_rows() {
        // This is by no measure the most efficient algorithm.
        for (let y = 0; y < this.height; ++y) {
            while (this.row_full(y)) {
                this.clear_row(y);
            }
        }
    }

    colliding(coords) {
        return coords.some(
            c => this.cells[this.index(c.x, c.y)] != PieceType.NONE);
    }
}

const BOARD_WIDTH  = 10;
const BOARD_HEIGHT = 20;

// Convention: The 3 coordinates are the offsets from the center of the piece.
// The Y coordinate can't be positive or the piece will spawn out of bounds!
const INIT_COORDS = [
    // NONE
    [],
    // STICK
    [[-1, 0, 0],
     [1, 0, 0],
     [2, 0, 0],],
    // BOX
    [[0, 0, 1],
     [1, 0, 0],
     [1, 0, 1],],
    // JAY
    [[-1, 0, 0],
     [1, 0, 0],
     [1, 0, 1],],
    // ZEE
    [[-1, 0, 0],
     [0, 0, 1],
     [1, 0, 1],],
    // TEE
    [[-1, 0, 0],
     [1, 0, 0],
     [0, 0, 1],],
    // CHI
    [[-1, 0, 0],
     [0, 0, 1],
     [0, -1, 1],],
    // RAL
    [[1, 0, 0],
     [0, 0, 1],
     [0, -1, 1],],
    // LEGS
    [[-1, 0, 0],
     [0, 0, 1],
     [0, -1, 0],],
];

function in_bounds(pos) {
    return pos.x >= 0 &&
           pos.y >= 0 &&
           pos.x < BOARD_WIDTH &&
           pos.y < BOARD_HEIGHT;
}

function round_vec3_coords(v) {
    return new BABYLON.Vector3(
        Math.round(v.x), Math.round(v.y), Math.round(v.z));
}

function xy_from_vec3(v) {
    return new BABYLON.Vector2(v.x, v.y);
}

function zy_from_vec3(v) {
    return new BABYLON.Vector2(v.z, v.y);
}

class ControlPiece {
    constructor(
        piece_type,
        left_grid,
        right_grid,
        piece_type_materials_map,
        scene)
    {
        console.assert(
            piece_type != PieceType.NONE,
            "Tried to construct NONE ControlPiece.");

        this.left_active = true;
        this.right_active = true;

        this.type = piece_type;

        // All cube positions are relative to the piece center.
        const coords = [];
        for (let i = 0; i < 3; ++i) {
            coords.push(BABYLON.Vector3.FromArray(INIT_COORDS[piece_type][i]));
        }
        coords.push(new BABYLON.Vector3(0, 0, 0));

        // All cubes are parented to the center, so transformations only need
        // be applied to the center. The center starts at the "middle" of the
        // top of the game board.
        this.center = new BABYLON.TransformNode("", scene);
        this.center.setAbsolutePosition(new BABYLON.Vector3(
            BOARD_WIDTH / 2 - 1, BOARD_HEIGHT - 1, BOARD_WIDTH / 2 - 1));

        this.cubes = [];
        for (let i = 0; i < coords.length; ++i) {
            let cube = new BABYLON.MeshBuilder.CreateBox("", {}, scene);
            cube.material = piece_type_materials_map[this.type];
            cube.parent = this.center;
            cube.locallyTranslate(coords[i]);
            this.cubes.push(cube);
        }

        left_grid.set_cells(this.zy_coords(), this.type);
        right_grid.set_cells(this.xy_coords(), this.type);
    }

    swizzle_coords(swizzler_fn) {
        let coords = [];
        this.cubes.forEach(function(c) {
            const pos = round_vec3_coords(c.getAbsolutePosition());
            coords.push(swizzler_fn(pos));
        });
        return coords;
    }

    xy_coords() {
        return this.swizzle_coords(xy_from_vec3);
    }

    zy_coords() {
        return this.swizzle_coords(zy_from_vec3);
    }

    erase_active_projections(left_grid, right_grid) {
        if (this.left_active) {
            left_grid.set_cells(this.zy_coords(), PieceType.NONE);
        }
        if (this.right_active) {
            right_grid.set_cells(this.xy_coords(), PieceType.NONE);
        }
    }

    draw_left_projection(left_grid) {
        left_grid.set_cells(this.zy_coords(), this.type);
    }

    draw_right_projection(right_grid) {
        right_grid.set_cells(this.xy_coords(), this.type);
    }

    draw_active_projections(left_grid, right_grid) {
        if (this.left_active) {
            this.draw_left_projection(left_grid);
        }
        if (this.right_active) {
            this.draw_right_projection(right_grid);
        }
    }

    // Since we rely on the mesh positions of the cubes for game logic, we need
    // to force computation of the world matrices on every movement.
    force_compute_world_matrices() {
        this.center.computeWorldMatrix(true);
        this.cubes.forEach(c => c.computeWorldMatrix(true));
    }

    translate(dir, dist) {
        this.center.translate(dir, dist, BABYLON.Space.WORLD);
        this.force_compute_world_matrices();
    }

    left_bad_move(left_grid) {
        return this.left_active && (left_grid.colliding(this.zy_coords()) ||
            this.zy_coords().some(c => !in_bounds(c)));
    }

    right_bad_move(right_grid) {
        return this.right_active && (right_grid.colliding(this.xy_coords()) ||
            this.xy_coords().some(c => !in_bounds(c)));
    }

    // Make sure you erase the piece from both grids before calling, or you
    // will collide with yourself!
    bad_move(left_grid, right_grid) {
        return this.left_bad_move(left_grid) || this.right_bad_move(right_grid);
    }

    try_player_translate(v, left_grid, right_grid) {
        this.erase_active_projections(left_grid, right_grid);

        this.translate(v, 1);
        if (this.bad_move(left_grid, right_grid)) {
            this.translate(v, -1);
        }

        this.draw_active_projections(left_grid, right_grid);
    }

    drop_one_row(left_grid, right_grid) {
        this.erase_active_projections(left_grid, right_grid);

        const v = new BABYLON.Vector3(0, -1, 0);
        this.translate(v, 1);

        if (this.left_active) {
            if (this.left_bad_move(left_grid)) {
                this.translate(v, -1);
                this.draw_left_projection(left_grid);
                left_grid.clear_full_rows();
                this.left_active = false;
                this.translate(v, 1);
            }
        }
        if (this.right_active) {
            if (this.right_bad_move(right_grid)) {
                this.translate(v, -1);
                this.draw_right_projection(right_grid);
                right_grid.clear_full_rows();
                this.right_active = false;
                this.translate(v, 1);
            }
        }

        this.draw_active_projections(left_grid, right_grid);
    }

    active() {
        return this.left_active || this.right_active;
    }

    drop_until_inactive(left_grid, right_grid) {
        while (this.active()) {
            this.drop_one_row(left_grid, right_grid);
        }
    }

    rotate(axis, angle) {
        this.center.rotate(axis, angle, BABYLON.Space.WORLD);
        this.force_compute_world_matrices();
    }

    try_player_rotate(axis, left_grid, right_grid) {
        this.erase_active_projections(left_grid, right_grid);

        this.rotate(axis, Math.PI / 2);
        if (this.bad_move(left_grid, right_grid)) {
            this.rotate(axis, -Math.PI / 2);
        }

        this.draw_active_projections(left_grid, right_grid);
    }

    destroy() {
        this.cubes.forEach(c => c.dispose());
    }
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// "Fair" randomness via shuffling. Returns value in {1..n_types}.
class GrabBag {
    constructor(repeats_per_bag, n_types) {
        this.repeats_per_bag = repeats_per_bag;
        this.n_types = n_types;
        this.bag = [];
    }

    take_piece() {
        if (this.bag.length == 0) {
            for (let i = 0; i < this.repeats_per_bag * this.n_types; ++i) {
                this.bag.push(i % this.n_types);
            }
            shuffle(this.bag);
        }

        return this.bag.pop() + 1;
    }
}

function color_material(color, scene) {
    let material = new BABYLON.StandardMaterial("", scene);
    material.diffuseColor = color;
    return material;
}

function run_game() {
    let canvas = document.getElementById("renderCanvas");

    let engine = new BABYLON.Engine(
        canvas, true, { preserveDrawingBuffer: true, stencil: true });

    let scene = new BABYLON.Scene(engine);

    const control_piece_materials_map =
        colors.map(c => color_material(c, scene));
    const grid_cell_materials_map =
        colors.map(c => color_material(c, scene));

    // Only empty cells should be transparent.
    grid_cell_materials_map[0].alpha = 0.2;

    let camera = new BABYLON.FreeCamera(
        "", new BABYLON.Vector3(28, 10, 28), scene);
    camera.setTarget(new BABYLON.Vector3(
        (BOARD_WIDTH - 1) / 2, (BOARD_HEIGHT - 1) / 2, (BOARD_WIDTH - 1) / 2));

    const lights = [
        new BABYLON.HemisphericLight("", new BABYLON.Vector3(1, 0, 0), scene),
        new BABYLON.HemisphericLight("", new BABYLON.Vector3(0, 0, 1), scene),
    ];

    // Different intensity makes it easier to see the depth of the 3D piece.
    lights[0].intensity = 0.6;
    lights[1].intensity = 0.4;

    let right_grid = new Grid(
        BOARD_WIDTH,
        BOARD_HEIGHT,
        new BABYLON.Vector3(1, 0, 0),
        new BABYLON.Vector3(0, 1, 0),
        new BABYLON.Vector3(0, 0, BOARD_WIDTH + 2),
        new BABYLON.Vector3(-1, 0, 0),
        grid_cell_materials_map,
        scene);

    let left_grid = new Grid(
        BOARD_WIDTH,
        BOARD_HEIGHT,
        new BABYLON.Vector3(0, 0, 1),
        new BABYLON.Vector3(0, 1, 0),
        new BABYLON.Vector3(BOARD_WIDTH + 2, 0, 0),
        new BABYLON.Vector3(1, 0, -1),
        grid_cell_materials_map,
        scene);

    let grab_bag = new GrabBag(3, 8);

    let piece = new ControlPiece(
        grab_bag.take_piece(),
        left_grid, right_grid,
        control_piece_materials_map, scene);

    // 4 modifier keys.
    // X & C for translating in either plane.
    // Z & V for rotating in either plane.
    let key_down = {
        z: false,
        x: false,
        c: false,
        v: false,
    };

    scene.actionManager = new BABYLON.ActionManager(scene);

    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnKeyDownTrigger,
        function (evt) {
            console.log("Pressed: " + evt.sourceEvent.key);

            if (evt.sourceEvent.key == "z") {
                key_down.z = true;
            } else if (evt.sourceEvent.key == "x") {
                key_down.x = true;
            } else if (evt.sourceEvent.key == "c") {
                key_down.c = true;
            } else if (evt.sourceEvent.key == "v") {
                key_down.v = true;
            } else if (evt.sourceEvent.key == " ") {
                piece.drop_until_inactive(left_grid, right_grid);
            } else if (key_down.z) {
                if (evt.sourceEvent.key == "ArrowLeft") {
                    piece.try_player_rotate(
                        new BABYLON.Vector3(-1, 0, 0), left_grid, right_grid);
                } else if (evt.sourceEvent.key == "ArrowRight") {
                    piece.try_player_rotate(
                        new BABYLON.Vector3(1, 0, 0), left_grid, right_grid);
                }
            } else if (key_down.x) {
                if (evt.sourceEvent.key == "ArrowLeft") {
                    piece.try_player_translate(
                        new BABYLON.Vector3(0, 0, -1), left_grid, right_grid);
                } else if (evt.sourceEvent.key == "ArrowRight") {
                    piece.try_player_translate(
                        new BABYLON.Vector3(0, 0, 1), left_grid, right_grid);
                }
            } else if (key_down.c) {
                if (evt.sourceEvent.key == "ArrowLeft") {
                    piece.try_player_translate(
                        new BABYLON.Vector3(1, 0, 0), left_grid, right_grid);
                } else if (evt.sourceEvent.key == "ArrowRight") {
                    piece.try_player_translate(
                        new BABYLON.Vector3(-1, 0, 0), left_grid, right_grid);
                }
            } else if (key_down.v) {
                if (evt.sourceEvent.key == "ArrowLeft") {
                    piece.try_player_rotate(
                        new BABYLON.Vector3(0, 0, -1), left_grid, right_grid);
                } else if (evt.sourceEvent.key == "ArrowRight") {
                    piece.try_player_rotate(
                        new BABYLON.Vector3(0, 0, 1), left_grid, right_grid);
                }
            } else {
                if (evt.sourceEvent.key == "ArrowLeft") {
                    piece.try_player_rotate(
                        new BABYLON.Vector3(0, 1, 0), left_grid, right_grid);
                } else if (evt.sourceEvent.key == "ArrowRight") {
                    piece.try_player_rotate(
                        new BABYLON.Vector3(0, -1, 0), left_grid, right_grid);
                }
            }
        }
    ));

    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnKeyUpTrigger,
        function (evt) {
            console.log("Released: " + evt.sourceEvent.key);

            if (evt.sourceEvent.key == "z") {
                key_down.z = false;
            } else if (evt.sourceEvent.key == "x") {
                key_down.x = false;
            } else if (evt.sourceEvent.key == "c") {
                key_down.c = false;
            } else if (evt.sourceEvent.key == "v") {
                key_down.v = false;
            }
        }
    ));

    let drop_time = 0;
    engine.runRenderLoop(function () {
        if (scene) {
            scene.render();

            drop_time += 0.01;
            if (drop_time > 0.25) {
                drop_time = 0;
                piece.drop_one_row(left_grid, right_grid);

                if (!piece.active()) {
                    piece.destroy();
                    piece = new ControlPiece(
                        grab_bag.take_piece(),
                        left_grid, right_grid,
                        control_piece_materials_map, scene);
                }
            }
        }
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });

}

run_game();
