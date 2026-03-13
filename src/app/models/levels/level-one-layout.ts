import { Cell } from '../grid/grid';

export const LEVEL_ONE_GRID_WIDTH = 15;
export const LEVEL_ONE_GRID_HEIGHT = 15;
export const LEVEL_ONE_CELL_SIZE = 50;

const LEVEL_ONE_ROUTE_COORDINATES: Array<[number, number]> = [
  [2, 0],
  [2, 1],
  [2, 2],
  [2, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 3],
  [7, 2],
  [8, 1],
  [9, 1],
  [10, 1],
  [11, 1],
  [12, 1],
  [12, 2],
  [12, 3],
  [12, 4],
  [12, 5],
  [12, 7],
  [12, 8],
  [12, 9],
  [12, 10],
  [11, 10],
  [9, 10],
  [8, 10],
  [7, 9],
  [6, 8],
  [5, 7],
  [4, 7],
  [3, 7],
  [2, 7],
  [1, 7],
  [1, 8],
  [1, 9],
  [1, 10],
  [1, 11],
  [1, 12],
  [1, 13],
  [2, 13],
  [3, 13],
  [4, 13],
  [5, 13],
  [6, 13],
  [7, 13],
  [8, 13],
  [9, 13],
  [10, 13],
  [10, 12],
  [10, 11],
  [10, 10],
  [10, 9],
  [10, 8],
  [10, 7],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
];

export const LEVEL_ONE_ROUTE_SET = new Set(LEVEL_ONE_ROUTE_COORDINATES.map(([x, y]) => `${x},${y}`));

export const LEVEL_ONE_ROUTE: Cell[] = LEVEL_ONE_ROUTE_COORDINATES.map(([x, y]) => ({
  x,
  y,
  drawx: x * LEVEL_ONE_CELL_SIZE,
  drawy: y * LEVEL_ONE_CELL_SIZE,
  width: LEVEL_ONE_CELL_SIZE,
  height: LEVEL_ONE_CELL_SIZE,
  imageIndex: null,
  steps: 0,
  done: false,
  parentcell: null,
  placeHolder: null,
  cellcolor: 'grey',
}));

export function isLevelOnePathCell(x: number, y: number): boolean {
  return LEVEL_ONE_ROUTE_SET.has(`${x},${y}`);
}

export function getLevelOneBuildableCells(): Array<[number, number]> {
  const buildable: Array<[number, number]> = [];

  for (let x = 0; x < LEVEL_ONE_GRID_WIDTH; x++) {
    for (let y = 0; y < LEVEL_ONE_GRID_HEIGHT; y++) {
      if (!isLevelOnePathCell(x, y)) {
        buildable.push([x, y]);
      }
    }
  }

  return buildable;
}
