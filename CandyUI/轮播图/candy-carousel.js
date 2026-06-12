/* ============================================
   CandyUI - 轮播图组件JavaScript
   完整功能实现：自动播放、手势支持、无限循环、3D效果
   ============================================ */

class CandyCarousel {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            autoplay: true,
            autoplayInterval: 3000,
            speed: 500,
            effect: 'slide', // slide, fade, cube, flip, coverflow
            loop: true,
            keyboard: true,
            touch: true,
            arrows: true,
            dots: true,
            initialIndex: 0,
            ...options
        };
        
        this.currentIndex = this.options.initialIndex;
        this.isAnimating = false;
        this.autoplayTimer = null;
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        this.init();
    }

    init() {
        this.createStructure();
        this.bindEvents();
        if (this.options.autoplay) {
            this.startAutoplay();
        }
    }

    createStructure() {
        const track = this.element.querySelector('.carousel-track');
        const slides = track.querySelectorAll('.carousel-slide');
        
        // 添加索引属性
        slides.forEach((slide, index) => {
            slide.dataset.index = index;
        });
        
        this.track = track;
        this.slides = slides;
        this.slideCount = slides.length;
        
        // 创建箭头
        if (this.options.arrows) {
            this.createArrows();
        }
        
        // 创建指示点
        if (this.options.dots) {
            this.createDots();
        }
        
        // 初始化显示
        this.goTo(this.currentIndex, false);
    }

    createArrows() {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-arrow prev';
        prevBtn.innerHTML = '❮';
        prevBtn.setAttribute('aria-label', '上一张');
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-arrow next';
        nextBtn.innerHTML = '❯';
        nextBtn.setAttribute('aria-label', '下一张');
        
        this.element.appendChild(prevBtn);
        this.element.appendChild(nextBtn);
        
        this.prevBtn = prevBtn;
        this.nextBtn = nextBtn;
    }

    createDots() {
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'carousel-dots';
        
        for (let i = 0; i < this.slideCount; i++) {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot';
            dot.setAttribute('aria-label', `跳转到第${i + 1}张`);
            dot.dataset.index = i;
            dotsContainer.appendChild(dot);
        }
        
        this.element.appendChild(dotsContainer);
        this.dotsContainer = dotsContainer;
    }

    bindEvents() {
        // 箭头事件
        if (this.options.arrows) {
            this.prevBtn.addEventListener('click', () => this.prev());
            this.nextBtn.addEventListener('click', () => this.next());
        }
        
        // 指示点事件
        if (this.options.dots) {
            this.dotsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('carousel-dot')) {
                    this.goTo(parseInt(e.target.dataset.index));
                }
            });
        }
        
        // 悬停暂停
        this.element.addEventListener('mouseenter', () => {
            if (this.options.autoplay) {
                this.stopAutoplay();
            }
        });
        
        this.element.addEventListener('mouseleave', () => {
            if (this.options.autoplay) {
                this.startAutoplay();
            }
        });
        
        // 触摸事件
        if (this.options.touch) {
            this.bindTouchEvents();
        }
        
        // 键盘事件
        if (this.options.keyboard) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') this.prev();
                if (e.key === 'ArrowRight') this.next();
            });
        }
        
        // 过渡结束事件
        this.track.addEventListener('transitionend', () => {
            this.isAnimating = false;
        });
    }

    bindTouchEvents() {
        this.track.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.stopAutoplay();
        }, { passive: true });
        
        this.track.addEventListener('touchmove', (e) => {
            this.touchEndX = e.touches[0].clientX;
        }, { passive: true });
        
        this.track.addEventListener('touchend', () => {
            const diff = this.touchStartX - this.touchEndX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.next();
                } else {
                    this.prev();
                }
            }
            
            if (this.options.autoplay) {
                this.startAutoplay();
            }
        });
    }

    goTo(index, animate = true) {
        if (this.isAnimating && animate) return;
        
        // 处理循环
        if (this.options.loop) {
            if (index < 0) index = this.slideCount - 1;
            if (index >= this.slideCount) index = 0;
        } else {
            if (index < 0) index = 0;
            if (index >= this.slideCount) index = this.slideCount - 1;
        }
        
        this.currentIndex = index;
        
        if (animate) {
            this.isAnimating = true;
        }
        
        this.applyEffect(index, animate);
        this.updateIndicators();
        this.dispatchEvent('candy-carousel-change', { index: this.currentIndex });
    }

    applyEffect(index, animate) {
        const duration = animate ? this.options.speed : 0;
        
        switch (this.options.effect) {
            case 'slide':
                this.track.style.transition = `transform ${duration}ms ease`;
                this.track.style.transform = `translateX(-${index * 100}%)`;
                break;
                
            case 'fade':
                this.slides.forEach((slide, i) => {
                    slide.style.transition = `opacity ${duration}ms ease`;
                    slide.style.opacity = i === index ? '1' : '0';
                });
                break;
                
            case 'cube':
                this.track.style.transition = `transform ${duration}ms ease`;
                this.track.style.transform = `rotateY(${index * -90}deg)`;
                this.track.style.transformStyle = 'preserve-3d';
                break;
                
            case 'flip':
                this.slides.forEach((slide, i) => {
                    slide.style.transition = `transform ${duration}ms ease`;
                    if (i === index) {
                        slide.classList.add('active');
                        slide.style.transform = 'rotateX(0deg)';
                    } else {
                        slide.classList.remove('active');
                        slide.style.transform = 'rotateX(-90deg)';
                    }
                });
                break;
                
            default:
                this.track.style.transition = `transform ${duration}ms ease`;
                this.track.style.transform = `translateX(-${index * 100}%)`;
        }
    }

    updateIndicators() {
        // 更新指示点
        if (this.options.dots) {
            const dots = this.dotsContainer.querySelectorAll('.carousel-dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === this.currentIndex);
            });
        }
    }

    prev() {
        this.goTo(this.currentIndex - 1);
    }

    next() {
        this.goTo(this.currentIndex + 1);
    }

    startAutoplay() {
        this.stopAutoplay();
        this.autoplayTimer = setInterval(() => {
            this.next();
        }, this.options.autoplayInterval);
    }

    stopAutoplay() {
        if (this.autoplayTimer) {
            clearInterval(this.autoplayTimer);
            this.autoplayTimer = null;
        }
    }

    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true
        });
        this.element.dispatchEvent(event);
    }

    destroy() {
        this.stopAutoplay();
        this.element.removeEventListener('mouseenter', () => this.stopAutoplay());
        this.element.removeEventListener('mouseleave', () => this.startAutoplay());
    }
}

// ============================================
// 全屏轮播类
// ============================================

class CandyFullscreenCarousel {
    constructor(options = {}) {
        this.options = {
            images: [],
            initialIndex: 0,
            autoplay: false,
            interval: 5000,
            ...options
        };
        
        this.currentIndex = this.options.initialIndex;
        this.isOpen = false;
        this.modal = null;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'candy-fullscreen-carousel';
        this.modal.innerHTML = `
            <div class="carousel-modal-content">
                <button class="carousel-modal-close">✕</button>
                <button class="carousel-modal-prev">❮</button>
                <div class="carousel-modal-image-container">
                    <img class="carousel-modal-image" src="" alt="">
                </div>
                <button class="carousel-modal-next">❯</button>
                <div class="carousel-modal-counter">1 / 1</div>
            </div>
        `;
        
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        const content = this.modal.querySelector('.carousel-modal-content');
        content.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const imgContainer = this.modal.querySelector('.carousel-modal-image-container');
        imgContainer.style.cssText = `
            max-width: 90%;
            max-height: 90%;
        `;
        
        const img = this.modal.querySelector('.carousel-modal-image');
        img.style.cssText = `
            max-width: 100%;
            max-height: 90vh;
            object-fit: contain;
            border-radius: 8px;
        `;
        
        const close = this.modal.querySelector('.carousel-modal-close');
        close.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            z-index: 10;
        `;
        
        close.addEventListener('mouseenter', () => {
            close.style.background = 'rgba(255, 255, 255, 0.2)';
        });
        
        close.addEventListener('mouseleave', () => {
            close.style.background = 'rgba(255, 255, 255, 0.1)';
        });
        
        const prev = this.modal.querySelector('.carousel-modal-prev');
        prev.style.cssText = `
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        const next = this.modal.querySelector('.carousel-modal-next');
        next.style.cssText = `
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        const counter = this.modal.querySelector('.carousel-modal-counter');
        counter.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: #fff;
            font-size: 16px;
        `;
        
        document.body.appendChild(this.modal);
    }

    bindEvents() {
        this.modal.querySelector('.carousel-modal-close').addEventListener('click', () => {
            this.close();
        });
        
        this.modal.querySelector('.carousel-modal-prev').addEventListener('click', () => {
            this.prev();
        });
        
        this.modal.querySelector('.carousel-modal-next').addEventListener('click', () => {
            this.next();
        });
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (this.isOpen) {
                if (e.key === 'Escape') this.close();
                if (e.key === 'ArrowLeft') this.prev();
                if (e.key === 'ArrowRight') this.next();
            }
        });
    }

    open(images, startIndex = 0) {
        this.options.images = images;
        this.currentIndex = startIndex;
        this.isOpen = true;
        this.updateImage();
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.isOpen = false;
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.options.images.length) % this.options.images.length;
        this.updateImage();
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.options.images.length;
        this.updateImage();
    }

    updateImage() {
        const img = this.modal.querySelector('.carousel-modal-image');
        const counter = this.modal.querySelector('.carousel-modal-counter');
        
        img.style.opacity = '0';
        setTimeout(() => {
            img.src = this.options.images[this.currentIndex];
            img.style.opacity = '1';
        }, 200);
        
        counter.textContent = `${this.currentIndex + 1} / ${this.options.images.length}`;
    }
}

// ============================================
// 缩略图轮播类
// ============================================

class CandyThumbnailCarousel {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            thumbWidth: 100,
            thumbHeight: 70,
            ...options
        };
        
        this.mainCarousel = null;
        this.thumbnails = [];
        this.init();
    }

    init() {
        const mainElement = this.element.querySelector('.carousel-main');
        const thumbnailElement = this.element.querySelector('.carousel-thumbnails');
        
        if (mainElement) {
            this.mainCarousel = new CandyCarousel(mainElement, this.options);
        }
        
        if (thumbnailElement) {
            const thumbnails = thumbnailElement.querySelectorAll('.carousel-thumbnail');
            thumbnails.forEach((thumb, index) => {
                thumb.addEventListener('click', () => {
                    if (this.mainCarousel) {
                        this.mainCarousel.goTo(index);
                    }
                    this.setActiveThumbnail(index);
                });
                this.thumbnails.push(thumb);
            });
            
            this.setActiveThumbnail(0);
        }
        
        // 同步指示点
        if (mainElement) {
            mainElement.addEventListener('candy-carousel-change', (e) => {
                this.setActiveThumbnail(e.detail.index);
            });
        }
    }

    setActiveThumbnail(index) {
        this.thumbnails.forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
        
        // 滚动到可视区域
        const activeThumb = this.thumbnails[index];
        if (activeThumb) {
            activeThumb.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }
}

// ============================================
// 自动初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // 初始化所有轮播组件
    document.querySelectorAll('[data-carousel]').forEach(element => {
        const options = JSON.parse(element.dataset.carousel || '{}');
        new CandyCarousel(element, options);
    });
    
    // 初始化缩略图轮播
    document.querySelectorAll('.candy-thumbnail-carousel').forEach(element => {
        new CandyThumbnailCarousel(element);
    });
});

// 导出到全局
window.CandyCarousel = CandyCarousel;
window.CandyFullscreenCarousel = CandyFullscreenCarousel;
window.CandyThumbnailCarousel = CandyThumbnailCarousel;
