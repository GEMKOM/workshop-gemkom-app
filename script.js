import { guardRoute } from './authService.js';

document.addEventListener('DOMContentLoaded', async () => {

    if (!guardRoute()) {
        return;
    }
});