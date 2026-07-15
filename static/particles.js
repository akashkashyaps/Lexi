// Lightweight ambient particle network — dots drift and link with nearby
// dots, and gently follow the mouse. Runs on any <canvas class="particles-canvas">.
// Colors are read from CSS custom properties so it matches the active theme.

(function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function readColor(varName, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return value || fallback;
    }

    function hexToRgb(hex) {
        const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!match) return { r: 255, g: 122, b: 69 };
        return {
            r: parseInt(match[1], 16),
            g: parseInt(match[2], 16),
            b: parseInt(match[3], 16)
        };
    }

    function initCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        let width, height, particles;
        let mouse = { x: null, y: null };
        const PARTICLE_COUNT = 45;
        const LINK_DISTANCE = 130;
        const MOUSE_DISTANCE = 160;

        function resize() {
            const rect = canvas.parentElement.getBoundingClientRect();
            width = canvas.width = rect.width;
            height = canvas.height = rect.height;
        }

        function makeParticles() {
            particles = Array.from({ length: PARTICLE_COUNT }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 2 + 1.5
            }));
        }

        function getColors() {
            const accent = hexToRgb(readColor('--accent-primary', '#FF7A45'));
            const link = readColor('--particles-link-color', 'rgba(107, 100, 120, 0.25)');
            return { accent, link };
        }

        function step() {
            const { accent, link } = getColors();
            ctx.clearRect(0, 0, width, height);

            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                if (mouse.x !== null) {
                    const dx = p.x - mouse.x;
                    const dy = p.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MOUSE_DISTANCE) {
                        const pull = (MOUSE_DISTANCE - dist) / MOUSE_DISTANCE * 0.02;
                        p.vx -= dx * pull * 0.02;
                        p.vy -= dy * pull * 0.02;
                    }
                }

                // gentle speed damping so mouse interaction doesn't accelerate forever
                p.vx *= 0.995;
                p.vy *= 0.995;
            }

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i], b = particles[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < LINK_DISTANCE) {
                        ctx.strokeStyle = link;
                        ctx.globalAlpha = 1 - dist / LINK_DISTANCE;
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }
            ctx.globalAlpha = 1;

            for (const p of particles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.55)`;
                ctx.fill();
            }

            if (!prefersReducedMotion) {
                requestAnimationFrame(step);
            }
        }

        resize();
        makeParticles();
        window.addEventListener('resize', () => {
            resize();
            makeParticles();
        });

        canvas.parentElement.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });
        canvas.parentElement.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        step();
        if (prefersReducedMotion) {
            // Draw a single static frame instead of animating
            step();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('canvas.particles-canvas').forEach(initCanvas);
    });
})();
