document.addEventListener('DOMContentLoaded', () => {
    Array.prototype.map.call(document.getElementsByClassName('info'), e => e)
        .map((e, i) => {
            e.style.transitionDelay = `${(i + 1) * 200}ms`
            return e
        })
        .forEach(e => {
            e.style.left = 0
        });
})