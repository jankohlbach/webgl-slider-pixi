import * as PIXI from 'pixi.js';
import normalizeWheel from 'normalize-wheel';

const loadImages = (paths, whenLoaded) => {
  const imgs = new Map();

  paths.forEach((path, i) => {
    const img = new Image();

    img.onload = () => {
      imgs.set(i, { path, img });

      if (imgs.size === paths.length) whenLoaded(imgs);
    };

    img.src = path;
  });
};

const cover = (target, container) => {
  const containerW = container.width || container.w;
  const containerH = container.height || container.h;
  const targetW = target.width || target.w;
  const targetH = target.height || target.h;

  const rw = containerW / targetW;
  const rh = containerH / targetH;
  const r = (rw > rh) ? rw : rh;

  return {
    // eslint-disable-next-line no-bitwise
    top: (containerH - targetH * r) >> 1,
    // eslint-disable-next-line no-bitwise
    left: (containerW - targetW * r) >> 1,
    width: targetW * r,
    height: targetH * r,
    scale: r,
  };
};

const debounce = (func, timeout = 300) => {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
};

class Slider {
  constructor(slider) {
    this.slider = slider;

    this.slides = JSON.parse(slider.querySelector('.webgl-slides').innerHTML).slides;

    this.drag = 0;
    this.scroll = 0;
    this.slideTarget = -1;

    this.wasDragged = false;

    this.checkSizes();

    this.app = new PIXI.Application({
      backgroundColor: 0xffffff,
      width: window.innerWidth,
      height: this.slideHeight,
    });

    this.container = new PIXI.Container();

    this.app.stage.addChild(this.container);
    slider.appendChild(this.app.view);

    this.rafs = {
      scale: new Map(),
    };

    this.bindings();
    this.init();
  }

  bindings() {
    this.onResize = this.onResize.bind(this);
    this.initDrag = this.initDrag.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.handleMouseEnter = this.handleMouseEnter.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  init() {
    loadImages(this.slides.map((slide) => slide.imageUrl), (images) => {
      this.loadedImages = images;

      this.add();
      this.render();
    });

    this.initHorizontalScroll();
    this.initDrag();

    this.app.view.addEventListener('mouseenter', () => { document.body.style.cursor = 'grab'; });
    this.app.view.addEventListener('mouseleave', () => { document.body.style.removeProperty('cursor'); });

    window.addEventListener('resize', debounce(this.onResize));
  }

  onResize() {
    this.checkSizes();

    this.container.removeChildren();
    this.add();
  }

  checkSizes() {
    if (window.innerWidth < 540) {
      this.margin = 30;
      this.slideWidth = (window.innerWidth - 2.5 * this.margin);
    } else if (window.innerWidth < 768) {
      this.margin = 30;
      this.slideWidth = (window.innerWidth - 1 * this.margin) / 2;
    } else {
      this.margin = 50;
      this.slideWidth = (window.innerWidth - 2 * this.margin) / 3;
    }

    this.slideHeight = this.slideWidth * (3 / 2);
    this.sliderWidth = this.slides.length * (this.slideWidth + this.margin);

    if (this.app) {
      this.app.view.height = this.slideHeight;
    }
  }

  scale(el, index, from, to) {
    if (!this.rafs.scale.has(index)) {
      this.rafs.scale.set(index, {
        raf: null,
        progress: null,
      });
    }

    const raf = this.rafs.scale.get(index);

    if (raf.raf) {
      cancelAnimationFrame(raf.raf);
      raf.raf = null;
      raf.progress = 1 - raf.progress;
    } else {
      raf.progress = 1;
    }

    const animate = () => {
      const factor = from + (to - from) * (1 - raf.progress);

      el.scale.x = factor;
      el.scale.y = factor;

      raf.progress *= 0.92;

      if (raf.progress < 0.0001) {
        el.scale.x = to;
        el.scale.y = to;

        cancelAnimationFrame(raf.raf);
        raf.raf = null;
        raf.progress = 1;

        return;
      }

      raf.raf = requestAnimationFrame(animate);
    };

    raf.raf = requestAnimationFrame(animate);
  }

  handleMouseEnter(e) {
    const el = e.currentTarget.children[0].children[0];
    const index = e.currentTarget.parent.getChildIndex(e.currentTarget);

    this.scale(el, index, 1, 1.2);

    document.body.style.cursor = 'pointer';
  }

  handleMouseLeave(e) {
    const el = e.currentTarget.children[0].children[0];
    const index = e.currentTarget.parent.getChildIndex(e.currentTarget);

    this.scale(el, index, 1.2, 1);

    document.body.style.cursor = 'grab';
  }

  initHorizontalScroll() {
    this.slider.addEventListener('wheel', (e) => {
      this.slideTarget = -normalizeWheel(e).pixelY;
    });
  }

  handleDrag(e) {
    this.dragTimeout = setTimeout(() => {
      this.wasDragged = true;
    }, 200);

    document.body.style.cursor = 'grabbing';

    const clientX = e.clientX || e.touches[0].clientX;
    const target = this.drag - clientX;

    if (target !== 0) {
      this.slideTarget = (this.drag - clientX) * -1.5;
      this.drag = clientX;
    }
  }

  initDrag() {
    this.slider.addEventListener('mousedown', (e) => {
      this.wasDragged = false;
      this.drag = e.clientX || e.touches[0].clientX;
      this.slider.addEventListener('mousemove', this.handleDrag);
    });
    this.slider.addEventListener('touchstart', (e) => {
      this.wasDragged = false;
      this.drag = e.clientX || e.touches[0].clientX;
      this.slider.addEventListener('touchmove', this.handleDrag);
    });

    this.slider.addEventListener('mouseup', () => {
      if (this.dragTimeout) {
        clearTimeout(this.dragTimeout);
      }
      this.slider.removeEventListener('mousemove', this.handleDrag);
      this.slideTarget /= Math.abs(this.slideTarget);
      document.body.style.removeProperty('cursor');
    });
    this.slider.addEventListener('touchend', () => {
      if (this.dragTimeout) {
        clearTimeout(this.dragTimeout);
      }
      this.slider.removeEventListener('touchmove', this.handleDrag);
      this.slideTarget /= Math.abs(this.slideTarget);
      document.body.style.removeProperty('cursor');
    });
  }

  handleClick(e, i) {
    if (!this.wasDragged) {
      window.location = this.slides[i].url;
    }
  }

  add() {
    const parent = {
      w: this.slideWidth,
      h: this.slideHeight,
    };

    this.thumbs = [];

    this.loadedImages?.forEach((img, i) => {
      const texture = PIXI.Texture.from(img.img);
      const sprite = new PIXI.Sprite(texture);
      const container = new PIXI.Container();
      const spriteContainer = new PIXI.Container();

      const mask = new PIXI.Sprite(PIXI.Texture.WHITE);

      mask.width = this.slideWidth;
      mask.height = this.slideHeight;

      sprite.mask = mask;

      sprite.anchor.set(0.5);
      sprite.position.set(
        sprite.texture.orig.width / 2,
        sprite.texture.orig.height / 2,
      );

      const image = {
        w: sprite.texture.orig.width,
        h: sprite.texture.orig.height,
      };

      const coverInfo = cover(image, parent);

      spriteContainer.position.set(coverInfo.left, coverInfo.top);
      spriteContainer.scale.set(coverInfo.scale);

      container.x = (this.margin + this.slideWidth) * i;
      container.y = 0;

      container.interactive = true;
      container.on('mouseover', this.handleMouseEnter);
      container.on('mouseout', this.handleMouseLeave);
      container.on('click', (e) => this.handleClick(e, i));
      container.on('touchend', (e) => this.handleClick(e, i));

      spriteContainer.addChild(sprite);
      container.addChild(spriteContainer);
      container.addChild(mask);
      this.container.addChild(container);
      this.thumbs.push(container);
    });
  }

  calcPos(scroll, pos) {
    return ((scroll + pos + this.sliderWidth + this.slideWidth + this.margin)
      % this.sliderWidth) - this.slideWidth - this.margin;
  }

  render() {
    this.app.ticker.add(() => {
      this.app.renderer.render(this.container);

      this.scroll -= (this.scroll - this.slideTarget) * 0.1;

      this.thumbs.forEach((thumb) => {
        thumb.position.x = this.calcPos(this.scroll, thumb.position.x);
      });
    });
  }
}

export default Slider;
