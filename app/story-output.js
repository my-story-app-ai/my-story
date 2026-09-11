/* PDF layout stays on-device; source photos and finished artwork are not uploaded again. */
window.MyStoryOutput = (() => {
  const paper = '#fffaf0';
  const ink = '#28241f';
  const loadImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('An illustration could not be opened.'));
    image.src = src;
  });

  function textImage(text, width, height, maxSize) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const words = String(text || '').split(/\s+/);
    let lines = [];
    let size = maxSize;
    for (; size >= 8; size--) {
      ctx.font = `600 ${size}px sans-serif`;
      lines = [''];
      for (const word of words) {
        // Split long unbroken words so user-entered titles cannot escape the page.
        for (const letter of Array.from(word + ' ')) {
          const last = lines.length - 1;
          if (ctx.measureText(lines[last] + letter).width > width - 24) lines.push(letter);
          else lines[last] += letter;
        }
      }
      if (lines.length * size * 1.3 <= height - 12) break;
    }
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, index) => ctx.fillText(line.trim(), width / 2, height / 2 + (index - (lines.length - 1) / 2) * size * 1.3));
    return canvas;
  }

  async function build(plan, scenes, preset) {
    if (!window.PDFLib) throw new Error('PDF export could not load. Refresh and try again.');
    if (scenes.length !== 4 || scenes.some(scene => !scene?.dataUrl)) throw new Error('Four completed illustrations are required.');
    const pdf = await PDFLib.PDFDocument.create();
    pdf.setTitle(plan.title);
    pdf.setCreator('My Story');
    const images = await Promise.all(scenes.map(scene => loadImage(scene.dataUrl)));
    const isPrint = preset.outputType === 'print';
    const embedded = isPrint ? [] : await Promise.all(scenes.map(scene => pdf.embedJpg(scene.dataUrl)));
    const cm = preset.id === 'story-print-50x70' ? [50, 70] : [30, 40];
    const pageSize = isPrint ? cm.map(value => value * 72 / 2.54) : [576, 756];
    let preview;

    async function pageFor(indices, title, subtitle) {
      const [w, h] = pageSize;
      const page = pdf.addPage(pageSize);
      page.drawRectangle({x:0, y:0, width:w, height:h, color:PDFLib.rgb(1, 250/255, 240/255)});
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = Math.round(900 * h / w);
      const ctx = canvas.getContext('2d');
      ctx.scale(900 / w, 900 / w);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);
      const margin = w * .055;
      async function label(value, x, y, width, height, size) {
        const pixels = isPrint ? Math.ceil(width * 300 / 72) : 1600;
        const bitmap = textImage(value, pixels, Math.max(60, Math.round(pixels * height / width)), Math.round(size * pixels / 1600));
        const png = await pdf.embedPng(bitmap.toDataURL('image/png'));
        page.drawImage(png, {x, y:h-y-height, width, height});
        ctx.drawImage(bitmap, x, y, width, height);
        bitmap.width = bitmap.height = 1;
      }
      await label(title, margin, h*.04, w-2*margin, h*.12, 80);
      const grid = indices.length > 1;
      const gap = w*.03;
      const tile = grid ? Math.min((w-2*margin-gap)/2, h*.30) : Math.min(w-2*margin, h*.55);
      const top = grid ? h*.21 : h*.20;
      for (let position = 0; position < indices.length; position++) {
        const index = indices[position];
        const x = grid ? (w-2*tile-gap)/2 + position%2*(tile+gap) : (w-tile)/2;
        const y = top + (grid ? Math.floor(position/2) * (tile+h*.065) : 0);
        page.drawRectangle({x:x-1, y:h-y-tile-1, width:tile+2, height:tile+2, color:PDFLib.rgb(.16,.14,.12)});
        let artwork = embedded[index];
        if(isPrint){
          // Render one panel at a time instead of allocating a 49-megapixel mobile canvas.
          const panel=document.createElement('canvas');
          panel.width=panel.height=Math.ceil(tile*300/72);
          const context=panel.getContext('2d');
          context.imageSmoothingQuality='high';
          context.drawImage(images[index],0,0,panel.width,panel.height);
          artwork=await pdf.embedJpg(panel.toDataURL('image/jpeg',.94));
          panel.width=panel.height=1;
        }
        page.drawImage(artwork, {x, y:h-y-tile, width:tile, height:tile});
        ctx.fillStyle = ink;
        ctx.fillRect(x-1, y-1, tile+2, tile+2);
        ctx.drawImage(images[index], x, y, tile, tile);
        if (grid) await label(`${index+1}. ${plan.scenes[index].title}`, x, y+tile+4, tile, h*.05, 68);
      }
      if (!grid) await label(subtitle || '', margin, h*.80, w-2*margin, h*.12, 48);
      await label('MY STORY', margin, h*.953, w-2*margin, h*.025, 26);
      if (!preview) preview = canvas.toDataURL('image/jpeg', .88);
      canvas.width = canvas.height = 1;
    }

    await pageFor([0,1,2,3], plan.title, '');
    if (!isPrint) {
      for (let i=0; i<4; i++) await pageFor([i], plan.scenes[i].title, plan.scenes[i].summary || '');
    }
    const bytes = await pdf.save();
    return {blob:new Blob([bytes], {type:'application/pdf'}), preview, pages:isPrint ? 1 : 5};
  }
  return {build};
})();
