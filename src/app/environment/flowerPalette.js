// Retain downloaded sources, but exclude retired species from every render path.
// Null choices leave natural gaps instead of moving or replacing other flowers.
export const isMeadowFlowerEnabled=species=>Boolean(species)&&species!=='Red Clover';
