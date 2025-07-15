// @ts-check
//
// this file is run in the browser! see the README for more infomation
//

/** @typedef {import("./jsmpeg").Player} Player */

(() => {
  /** @returns {Promise<void>} */
  const importJSMpeg = () =>
    new Promise((resolve, reject) => {
      if (window.JSMpeg) {
        resolve(); // already loaded
        return;
      }

      // 定义多个url，直到script加载成功

      const urls = [
        'https://cdn.jsdelivr.net/gh/phoboslab/jsmpeg@b5799bf/jsmpeg.min.js',
        'https://cdn.staticfile.net/jsmpeg/0.2/jsmpg.min.js',
        'https://cdn.bootcdn.net/ajax/libs/jsmpeg/0.2/jsmpg.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jsmpeg/0.2/jsmpg.min.js',
        'https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/jsmpeg/0.2/jsmpg.min.js',
        'https://illusion-tech-public.obs.cn-north-9.myhuaweicloud.com/cdn/jsmpg.min.js'
      ];

      let index = 0;
      const loadNext = () => {
        if (index >= urls.length) {
          reject(new Error('Failed to load JSMpeg'));
          return;
        }
        const url = urls[index];
        index++;

        const script = Object.assign(document.createElement('script'), {
          src: url,
          onload: resolve,
          onerror: () => {
            script.remove(); // 移除失败的脚本标签
            loadNext();
          },
        });

        // 添加超时处理
        const timeout = setTimeout(() => {
          script.remove();
          loadNext();
        }, 5000); // 5秒超时

        script.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        document.head.appendChild(script);
      };
      loadNext();
    });

  /**
   * Creates a `Player`. If you intend to create multiple players, you must
   * await for this promise to complete before creating the next player.
   * @param {import("./jsmpeg").PlayerOptions} options
   * @returns {Promise<Player>}
   */
  const loadPlayer = ({
    url,
    onDisconnect,
    disconnectThreshold = 3e3,
    ...options
  }) =>
    importJSMpeg().then(() => {
      return new Promise((resolve, reject) => {
        // hide the canvas until it's loaded and the correct size
        const originalDisplay = options.canvas.style.display;
        // eslint-disable-next-line no-param-reassign
        options.canvas.style.display = 'none';

        let lastRx = Date.now(); // Date.now() is more efficient than performance.now()

        if (options.onVideoDecode && onDisconnect) {
          reject(
            new Error('You cannot specify both onDisconnect and onVideoDecode'),
          );
          return;
        }

        const player = new window.JSMpeg.Player(url, {
          // for performance reasons, only record last packet Rx time if onDisconnect is specified
          onVideoDecode: onDisconnect
            ? () => {
                lastRx = Date.now();
              }
            : undefined,

          // MutationObserver doesn't always work, see #202
          onSourceEstablished: (...args) => {
            // eslint-disable-next-line no-param-reassign
            options.canvas.style.display = originalDisplay;
            resolve(player);
            return options?.onSourceEstablished?.(...args);
          },

          ...options,
        });

        const o = new MutationObserver((mutations) => {
          if (mutations.some((m) => m.type === 'attributes')) {
            // eslint-disable-next-line no-param-reassign
            options.canvas.style.display = originalDisplay;
            resolve(player);
            o.disconnect();
          }
        });
        o.observe(options.canvas, { attributes: true });

        if (onDisconnect) {
          const i = setInterval(() => {
            if (Date.now() - lastRx > disconnectThreshold) {
              onDisconnect(player);
              clearInterval(i);
            }
          }, disconnectThreshold / 2);
        }
      });
    });

  if (typeof module !== 'undefined') {
    // being imported
    module.exports = { loadPlayer };
  } else {
    // loaded via script tag
    window.loadPlayer = loadPlayer;
  }
})();
