const CandyCheckbox = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.closest('.candy-checkbox')) {
                this.handleCheckboxChange(e.target);
            }
        });

        document.addEventListener('click', (e) => {
            const checkbox = e.target.closest('.candy-checkbox');
            if (checkbox) {
                const input = checkbox.querySelector('input[type="checkbox"]');
                if (input) {
                    checkbox.dispatchEvent(new CustomEvent('candy-checkbox-change', {
                        detail: { 
                            checked: input.checked, 
                            value: input.value 
                        },
                        bubbles: true
                    }));
                }
            }
        });
    },

    handleCheckboxChange(checkbox) {
        checkbox.dispatchEvent(new CustomEvent('candy-checkbox-change', {
            detail: { 
                checked: checkbox.checked, 
                value: checkbox.value 
            },
            bubbles: true
        }));
    },

    check(selector) {
        const checkbox = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (checkbox) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new CustomEvent('change'));
        }
    },

    uncheck(selector) {
        const checkbox = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (checkbox) {
            checkbox.checked = false;
            checkbox.dispatchEvent(new CustomEvent('change'));
        }
    },

    toggle(selector) {
        const checkbox = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new CustomEvent('change'));
        }
    },

    isChecked(selector) {
        const checkbox = typeof selector === 'string' ? document.querySelector(selector) : selector;
        return checkbox ? checkbox.checked : false;
    },

    disable(selector) {
        const checkbox = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (checkbox) {
            checkbox.disabled = true;
            checkbox.closest('.candy-checkbox').style.opacity = '0.6';
            checkbox.closest('.candy-checkbox').style.cursor = 'not-allowed';
        }
    },

    enable(selector) {
        const checkbox = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (checkbox) {
            checkbox.disabled = false;
            checkbox.closest('.candy-checkbox').style.opacity = '1';
            checkbox.closest('.candy-checkbox').style.cursor = 'pointer';
        }
    },

    create(options = {}) {
        const container = document.createElement('label');
        container.className = `candy-checkbox candy-checkbox-${options.style || 1}`;
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        if (options.value) input.value = options.value;
        if (options.checked) input.checked = true;
        if (options.disabled) input.disabled = true;
        
        const checkmark = document.createElement('span');
        checkmark.className = 'checkmark';
        
        container.appendChild(input);
        container.appendChild(checkmark);
        
        if (options.onChange) {
            input.addEventListener('change', (e) => {
                options.onChange(e.target.checked, e);
            });
        }
        
        if (options.parent) {
            document.querySelector(options.parent).appendChild(container);
        }
        
        return container;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CandyCheckbox.init();
});