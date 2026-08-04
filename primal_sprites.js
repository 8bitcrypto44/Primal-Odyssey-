/* Baked from CC0 LPC animals (OGA) + Kenney Animal Pack Redux */
(function (global) {
  function drawGrid(ctx, grid, palette, s, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "." || ch === " ") continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect((ox + x) * s, (oy + y) * s, s, s);
      }
    }
  }
  function clonePal(pal, map) {
    const out = {};
    for (const k in pal) out[k] = map[pal[k]] || pal[k];
    return out;
  }
  const SPRITES = {
player:{s:3,pal:{X:"#e8c4a0",H:"#3a2a18",S:"#2a5a8a",P:"#1a3a5a",B:"#c45c26",K:"#111"},frames:[["....HHH....","...HXXXH...","...XXXXX...","....X.X....","...SSSSS...","..SBBBBBS..","..SB.S.BS..","...P...P...","...P...P...","...K...K..."]]},
lioness:{s:2,pal:{A:"#2e1f1c",B:"#40361d",C:"#704c2c",D:"#af8a35",E:"#a2794b",F:"#946b44",G:"#827c7c",H:"#dbd2ca"},grid:[".......................AB...",".....................ABCCDB.","..................AACCBDCDDB","................BBCCCEFDDCDG","....BEEEFFFFFFFFFEEDDEFFDDFB","....EDDDDDDDDDDDDDDDDFFCCFHA","...BDDDDDDDDDDDDDDDDEFFCBBAA","...BEEDDDDDDDDDDDDDEEB......","...FFFEEEEEEEDDEEEEFF.......","...FCFEEFFFEFFEEEFFFC.......","...FCFFFFFFFFFFFFFCCB.......","...FCFFFCBBCCCCCCEFBB.......","...FBFEFFB......BEEB........","C..EBEEEEB......BEE.........","AC.EBEEBBB.....BCFFB........","A..EBEE.BBB....BCFFB........",".FF.BFF........BCFFB........",".....FFB.......BCBFB........",".....BCCB......BBBB.........","......BBBB......BB..........",".......BBB.................."]},
wolf:{s:2,pal:{A:"#442725",B:"#e4a47c",C:"#7f4c31",D:"#ae6b3f",E:"#f9d5ba",F:"#cf6f30",G:"#ffffff"},grid:["....A...................","..AABC..................","..DBEDFC................","..BBEEBBFFFFFFFCC.......","..BEEEEEBBBFFFBFCCCFFEDD","AAEEEBEEEBEBBEEBFCCFBEED",".AAAGGBEEEEEEEEEEEBBCA..",".....AGBEEEEBBEEBCCC....","......CBBBBBGBEB........",".......DB.AAABEB........","........CA....CBA.......","........AAA....AA.......","................A.......","................A......."]},
hippo:{s:2,pal:{A:"#1b509b",B:"#4d9bff",C:"#3680e4",D:"#58b0ff",E:"#458df0",F:"#f2f9ff",G:"#133b75",H:"#3b6bac"},grid:["........AAAAA........",".ABBA.CDDDDDDDC.ABBA.",".EEEEDDDDDDDDDDDEEEE.","AECCDBBDDDDDDDBBDCCEA","ACCDBBBBBBBBBBBBBDCCA",".ACBBBBBBBBBBBBBBBCA.","..CBBBBBBBBBBBBBBBC..","..BBBBBBBBBBBBBBBBB..","..BBDFFBBBBBBBFFDBB..","..BBFGGBBBBBBBGGFBB..","..BBFGGBBBBBBBGGFBB..","..ABBFFBCCCCCBFFBBH..","..ABBBBCCCCCCCBBBBA..","...BBBCCCCCCACCBBB...","...ABBCCCCCCCCCBBG...","....GCCCCCCCCCCCG....","......HCCCCCCCH......","........AAAAA........"]},
buffalo:{s:2,pal:{A:"#79441c",B:"#e7b389",C:"#533116",D:"#fffde4",E:"#c07033",F:"#673f23",G:"#673f22",H:"#8f5d37"},grid:["...AB...C...CC..AA...","...DDADDDDEDDDDADD...","...DDDDDDDFDDDDDDD...","...GDDDDDDFDDDDDDA...",".AAAAEEEEFFFEEEEAAAA.","AFFCEEEEEFFFEEEEECFFA","AFCCEEDEEFFFEEDEECCFA","CFFCEDHEEFFFEDHDECFFC","..AHEEDEEFFFEEDEEHA..","...AEEEEFFFFFEEEEA...","...AEEEFCCFCCFEEEA...","....EEFFFFFFFFFEE....","....AEFFFFFFFFFEA....",".....EEFFFFFFFEE.....","......EFFFFFFFE......",".......AEFFFEA.......",".......GFFFFFG.......",".........A.A........."]},
rhino:{s:2,pal:{A:"#807777",B:"#d8cfcf",C:"#b0a7a7",D:"#f4f2f2",E:"#ccc2c2",F:"#e8e6e6",G:"#ffffff",H:"#504e4e"},grid:["........AAAAA........",".ABBA.CDDDDDDDC.ABBA.",".EEEEDDDDDDDDDDDEEEE.","AECCDFFDDDDDDDFFDCCEA","ACCDFFFFFFFFFFFFFDCCA",".ACFFFFFFFGFFFFFFFCA.","..CFFFFFFFGFFFFFFFC..","..FFFFFFFGGGFFFFFFF..","..FFGGGFFGGGFFGGGFF..","..FFGHHFEGGGEFHHGFF..","..FFGHHFEGGGEFHHGFF..","..AFFGGFEEEEEFGGFFC..","..AFFFFEEEEEEEFFFFA..","...FFFEECEEECEEFFF...","...AFFEEEEEEEEEFFA...","....HEEEEEEEEEEEH....","......CEEEEEEEC......","........AAAAA........"]},
gorilla:{s:2,pal:{A:"#191818",B:"#3b3939",C:"#353434",D:"#ddd3d3",E:"#121212",F:"#6e6b6b",G:"#fcfbfb",H:"#242323"},grid:["......AAAAAA......","....ABCCCCCCBA....","...ACCCBBBBCCCA...","..ACCCCBBBBCCCCC..",".ACCCCCBBBBCCCCCA.",".BCCDDDDCCDDDDCCB.","ECCDDDDDDDDDDDDCCA","ACDDDDDDDDDDDDDDCA","ACDDFFDDDDDDFFGDCA","ACDDFFDDDDDDFFGDCA","ACCDDDDDDDDDDDDCCA","ECCCDDDDDDDDDDCCCA",".CCCDDGGGGGGDDCCC.",".ACCDDGGGGGGGDCCA.","..ACCDDDDDDDDCCH..","...ACCDDDDDDCCA...","....ACCFDDDCCA....","......AAAAAA......"]},
anaconda:{s:2,pal:{A:"#008336",B:"#19ee73",C:"#19f777",D:"#1ad96c",E:"#17f274",F:"#88ffbc",G:"#07a64a",H:"#fb3c27"},grid:[".....AABBAA.....","...ACDDDDDDCA...","..ACDDDDDDDDCA..",".ABBDECCCCCDBBA.",".CBBDDCCCCDDBBC.","ABBBBDDCCDDBBBBA","ABBBBBDCCDBBBBBA","DBBBBBBBBBBBBBBD","BBBFBBBBBBBBFBBB","ABFFFBBBBBBFFFBA","ABFFFBBBBBBFFFBA",".BBFFBGBBGBBFBB.",".ABBBBDBBDBBBDA.","..GDFBBBBBBFDG..","...ADDHHHHDDA...","....AAHHHHAA....","......HHHH......","......AAAA......"]},
eagle:{s:2,pal:{A:"#693309",B:"#c8712b",C:"#af5f22",D:"#8f4b17",E:"#ffeccd",F:"#fabf75",G:"#ffffff",H:"#505050"},grid:["......AAAAAA......","....ABCCCCCCBA....","...ACCCCCCDCCCA...","..ACCCCDCDDCCCCA..",".ACCCCCDCDDCCCCCA.",".BCCCCCCCDCCCCCCB.","ACEEEEECCCCEEEEECA","ACFEEEEECCEEEEEFCA","ACEEGHGECCEGHGEECA","ACEEGHGEBBEGHGEECA","ACCEEGEBBBBEGEECCA","ACCEEEEBBBBEEEECCA",".CCCCCCCCCCCCCCCC.",".DCCCEEEEEEEFCCCD.",".DDCEEEEEEEEECCDD.",".ADAEFEEEEEEFEADA.","..AAAEEEEEEEEAAA..","......AAAAAA......"]},
honeybadger:{s:2,pal:{A:"#6f6a6a",B:"#9e9595",C:"#a9a0a0",D:"#eeebeb",E:"#bdb5b5",F:"#7f7979",G:"#ffffff",H:"#343434"},grid:["..A.........A..",".ABA.......ABA.",".ABC.......CBA.",".CBDAAAAAAADBC.",".BBDEEEEEEEDBB.",".FCCCEEEEECCCF.",".ACCCCCCCCCCCA.",".CDDDCCCCCDDDC.","ACDDDDCCCDDDDCA","ADDGGDCCCDGGDDA","FDGHHDCCCDHHGDF","ACDGDDHHHDDGDCA","ACCDDEDHDDDDCCA",".CDDDHHDHHDDDC.",".ADDDDDDDDDDDA.","..ADDDDDDDDDA..","...ADDDDDDDA...",".....AEDEA....."]}
  };
  // Big-cat variants from lioness base (saves size, keeps LPC silhouette)
  if (SPRITES.lioness) {
    const g = SPRITES.lioness.grid, s = SPRITES.lioness.s, p = SPRITES.lioness.pal;
    SPRITES.lion = SPRITES.lioness;
    SPRITES.cougar = { s:s, grid:g, pal:clonePal(p, {"#af8a35":"#c49a4a","#a2794b":"#b8894a","#946b44":"#8a6a30"}) };
    SPRITES.tiger = { s:s, grid:g, pal:clonePal(p, {"#af8a35":"#e07a2a","#a2794b":"#c45c18","#946b44":"#8a4010","#704c2c":"#3a2010"}) };
    SPRITES.leopard = { s:s, grid:g, pal:clonePal(p, {"#af8a35":"#c49a4a","#a2794b":"#b8894a"}) };
    SPRITES.jaguar = SPRITES.leopard;
    SPRITES.snowleopard = { s:s, grid:g, pal:clonePal(p, {"#af8a35":"#c5d0dc","#a2794b":"#a8b4c0","#946b44":"#7a8898","#704c2c":"#5a6570","#2e1f1c":"#3a4550"}) };
  }
  if (!SPRITES.grizzly) SPRITES.grizzly = SPRITES.wolf;
  function drawSprite(ctx, id, x, y, scale, frame) {
    const sp = SPRITES[id];
    if (!sp) return;
    const s = (sp.s || 2) * (scale || 1);
    ctx.save();
    ctx.translate(x | 0, y | 0);
    if (sp.frames) drawGrid(ctx, sp.frames[(frame || 0) % sp.frames.length], sp.pal, s | 0 || s);
    else drawGrid(ctx, sp.grid, sp.pal, Math.max(1, s | 0) || s);
    ctx.restore();
  }
  function spriteSize(id, scale) {
    const sp = SPRITES[id];
    if (!sp) return { w: 16, h: 16 };
    const s = (sp.s || 2) * (scale || 1);
    const g = sp.frames ? sp.frames[0] : sp.grid;
    return { w: g[0].length * s, h: g.length * s };
  }
  global.PO_SPRITES = { drawSprite: drawSprite, spriteSize: spriteSize, SPRITES: SPRITES };
})(window);
