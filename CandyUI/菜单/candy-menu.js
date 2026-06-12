const CandyMenu = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.querySelectorAll('.candy-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                link.dispatchEvent(new CustomEvent('candy-menu-click', {
                    detail: {
                        href: link.getAttribute('href'),
                        text: link.textContent
                    },
                    bubbles: true
                }));
            });
            
            link.addEventListener('mouseenter', () => {
                link.dispatchEvent(new CustomEvent('candy-menu-hover', {
                    detail: { active: true, text: link.textContent }
                }));
            });
            
            link.addEventListener('mouseleave', () => {
                link.dispatchEvent(new CustomEvent('candy-menu-hover', {
                    detail: { active: false, text: link.textContent }
                }));
            });
        });
    },

    create(options = {}) {
        const ul = document.createElement('ul');
        ul.className = `candy-menu candy-menu-${options.style || 1}`;
        
        if (options.items && Array.isArray(options.items)) {
            options.items.forEach(item => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = item.href || '#';
                a.textContent = item.text || '菜单项';
                a.setAttribute('data-text', item.text || '菜单项');
                
                if (item.onClick) {
                    a.addEventListener('click', (e) => {
                        item.onClick(e, item);
                    });
                }
                
                li.appendChild(a);
                ul.appendChild(li);
            });
        }
        
        if (options.parent) {
            document.querySelector(options.parent).appendChild(ul);
        }
        
        return ul;
    },

    addItem(selector, item) {
        const menu = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!menu) return;
        
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.href || '#';
        a.textContent = item.text || '菜单项';
        a.setAttribute('data-text', item.text || '菜单项');
        
        li.appendChild(a);
        menu.appendChild(li);
    },

    removeItem(selector, index) {
        const menu = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!menu) return;
        
        const items = menu.querySelectorAll('li');
        if (items[index]) {
            items[index].remove();
        }
    },

    setActive(selector, index) {
        const menu = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!menu) return;
        
        const items = menu.querySelectorAll('a');
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CandyMenu.init();
});