const CandyRadio = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.addEventListener('change', (e) => {
            if (e.target.type === 'radio' && e.target.closest('.candy-radio-item')) {
                this.handleRadioChange(e.target);
            }
        });

        document.addEventListener('click', (e) => {
            const radioItem = e.target.closest('.candy-radio-item');
            if (radioItem) {
                const input = radioItem.querySelector('input[type="radio"]');
                if (input) {
                    radioItem.dispatchEvent(new CustomEvent('candy-radio-change', {
                        detail: {
                            checked: input.checked,
                            value: input.value,
                            name: input.name
                        },
                        bubbles: true
                    }));
                }
            }
        });
    },

    handleRadioChange(radio) {
        radio.dispatchEvent(new CustomEvent('candy-radio-change', {
            detail: {
                checked: radio.checked,
                value: radio.value,
                name: radio.name
            },
            bubbles: true
        }));
    },

    check(selector) {
        const radio = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new CustomEvent('change'));
        }
    },

    uncheck(selector) {
        const radio = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (radio) {
            radio.checked = false;
            radio.dispatchEvent(new CustomEvent('change'));
        }
    },

    getChecked(groupName) {
        const checked = document.querySelector(`input[name="${groupName}"]:checked`);
        return checked ? { value: checked.value, element: checked } : null;
    },

    getValue(groupName) {
        const checked = document.querySelector(`input[name="${groupName}"]:checked`);
        return checked ? checked.value : null;
    },

    disable(selector) {
        const radio = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (radio) {
            radio.disabled = true;
            radio.closest('.candy-radio-item').style.opacity = '0.6';
            radio.closest('.candy-radio-item').style.cursor = 'not-allowed';
        }
    },

    enable(selector) {
        const radio = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (radio) {
            radio.disabled = false;
            radio.closest('.candy-radio-item').style.opacity = '1';
            radio.closest('.candy-radio-item').style.cursor = 'pointer';
        }
    },

    create(options = {}) {
        const container = document.createElement('div');
        const style = options.style || 1;
        
        options.options.forEach((opt, index) => {
            const item = document.createElement('div');
            item.className = `candy-radio-item candy-radio-${style}`;
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `${options.name}-${index}`;
            input.name = options.name;
            input.value = opt.value || opt;
            
            if (opt.selected || index === 0) input.checked = true;
            if (opt.disabled) input.disabled = true;
            
            const customRadio = document.createElement('span');
            customRadio.className = 'candy-radio-custom';
            
            const label = document.createElement('label');
            label.htmlFor = `${options.name}-${index}`;
            label.textContent = opt.label || opt;
            
            item.appendChild(input);
            item.appendChild(customRadio);
            item.appendChild(label);
            
            if (options.onChange) {
                input.addEventListener('change', (e) => {
                    options.onChange(e.target.value, e);
                });
            }
            
            container.appendChild(item);
        });
        
        if (options.parent) {
            document.querySelector(options.parent).appendChild(container);
        }
        
        return container;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CandyRadio.init();
});