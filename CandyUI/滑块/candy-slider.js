const CandySlider = {
    init() {
        this.bindEvents();
        this.initializeSliders();
    },

    initializeSliders() {
        const sliders = document.querySelectorAll('.candy-slider');
        sliders.forEach(slider => {
            this.updateTrack(slider);
            this.updateValueDisplay(slider);
        });
    },

    bindEvents() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('candy-slider')) {
                this.handleSliderChange(e.target);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('candy-slider')) {
                e.target.dispatchEvent(new CustomEvent('candy-slider-change', {
                    detail: { value: parseInt(e.target.value) },
                    bubbles: true
                }));
            }
        });
    },

    handleSliderChange(slider) {
        this.updateTrack(slider);
        this.updateValueDisplay(slider);
    },

    updateTrack(slider) {
        const container = slider.closest('.candy-slider-container');
        if (!container) return;
        
        const track = container.querySelector('.candy-slider-track');
        if (!track) return;
        
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const value = parseFloat(slider.value);
        const percentage = ((value - min) / (max - min)) * 100;
        
        track.style.width = percentage + '%';
    },

    updateValueDisplay(slider) {
        const container = slider.closest('.candy-slider-container');
        if (!container) return;
        
        const valueEl = container.querySelector('.candy-slider-value');
        if (valueEl) {
            valueEl.textContent = slider.value;
        }
    },

    setValue(selector, value) {
        const slider = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!slider) return;
        
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const clampedValue = Math.max(min, Math.min(max, value));
        
        slider.value = clampedValue;
        this.updateTrack(slider);
        this.updateValueDisplay(slider);
    },

    getValue(selector) {
        const slider = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!slider) return 0;
        return parseInt(slider.value) || 0;
    },

    create(options = {}) {
        const container = document.createElement('div');
        container.className = 'candy-slider-container';
        
        if (options.label) {
            const label = document.createElement('div');
            label.className = 'candy-slider-label';
            label.textContent = options.label;
            container.appendChild(label);
        }
        
        const row = document.createElement('div');
        row.className = 'candy-slider-row';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'candy-slider';
        slider.min = options.min || 0;
        slider.max = options.max || 100;
        slider.value = options.value || 50;
        
        if (options.variant) {
            slider.classList.add('candy-slider-' + options.variant);
        }
        
        const track = document.createElement('div');
        track.className = 'candy-slider-track';
        
        const value = document.createElement('span');
        value.className = 'candy-slider-value';
        value.textContent = slider.value;
        
        row.appendChild(slider);
        row.appendChild(value);
        
        container.appendChild(row);
        
        const percentage = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
        track.style.width = percentage + '%';
        
        const trackContainer = document.createElement('div');
        trackContainer.style.position = 'relative';
        trackContainer.style.height = '8px';
        trackContainer.style.marginBottom = '10px';
        trackContainer.appendChild(track);
        
        container.insertBefore(trackContainer, row);
        
        if (options.parent) {
            document.querySelector(options.parent).appendChild(container);
        }
        
        slider.addEventListener('input', () => {
            this.updateTrack(slider);
            this.updateValueDisplay(slider);
        });
        
        return container;
    },

    increment(selector, amount = 1) {
        const slider = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!slider) return;
        
        const current = parseFloat(slider.value);
        const max = parseFloat(slider.max) || 100;
        this.setValue(slider, Math.min(current + amount, max));
    },

    decrement(selector, amount = 1) {
        const slider = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!slider) return;
        
        const current = parseFloat(slider.value);
        const min = parseFloat(slider.min) || 0;
        this.setValue(slider, Math.max(current - amount, min));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CandySlider.init();
});