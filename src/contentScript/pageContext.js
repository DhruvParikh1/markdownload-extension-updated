(function marksnipMathJaxBridge() {
    const latexAttr = 'marksnip-latex';
    const syncEventName = 'marksnip:mathjax-sync';
    const syncRequestEventName = 'marksnip:mathjax-sync-request';

    function getMathItems() {
        const mathCollection = window.MathJax?.startup?.document?.math;
        if (!mathCollection) {
            return [];
        }

        if (typeof mathCollection[Symbol.iterator] === 'function') {
            try {
                return Array.from(mathCollection);
            } catch (error) {
                // Continue to fallback paths below.
            }
        }

        if (Array.isArray(mathCollection)) {
            return mathCollection;
        }

        if (Array.isArray(mathCollection.list)) {
            return mathCollection.list;
        }

        return [];
    }

    function dispatchSyncEvent(detail) {
        try {
            window.dispatchEvent(new CustomEvent(syncEventName, { detail }));
        } catch (error) {
            // Ignore cross-context event failures.
        }
    }

    function syncMathJaxLatex(reason) {
        const detail = {
            reason: reason || 'sync',
            mathJaxAvailable: typeof window.MathJax !== 'undefined',
            totalMathItems: 0,
            taggedCount: 0,
            timestamp: Date.now()
        };

        try {
            const mathItems = getMathItems();
            detail.totalMathItems = mathItems.length;

            for (const math of mathItems) {
                if (!math?.typesetRoot || typeof math.math !== 'string') {
                    continue;
                }
                math.typesetRoot.setAttribute(latexAttr, math.math);
                detail.taggedCount += 1;
            }
        } catch (error) {
            detail.error = String(error);
        }

        dispatchSyncEvent(detail);
        return detail;
    }

    if (!window.__marksnipMathJaxRequestListenerInstalled) {
        window.__marksnipMathJaxRequestListenerInstalled = true;
        window.addEventListener(syncRequestEventName, () => {
            syncMathJaxLatex('request');
        });
    }

    syncMathJaxLatex('init');

    const startupPromise = window.MathJax?.startup?.promise;
    if (startupPromise && typeof startupPromise.then === 'function') {
        startupPromise
            .then(() => syncMathJaxLatex('startup-promise'))
            .catch(() => syncMathJaxLatex('startup-promise-error'));
    }
})();
