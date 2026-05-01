const noop = () => Promise.resolve();

const RNBlobUtil = {
  fs: {
    dirs: {
      DocumentDir: '',
      CacheDir: '',
      MainBundleDir: '',
      MovieDir: '',
      MusicDir: '',
      PictureDir: '',
      LibraryDir: '',
      DCIMDir: '',
      DownloadDir: '',
      SDCardDir: '',
      SDCardApplicationDir: '',
    },
    exists: () => Promise.resolve(false),
    stat: () => Promise.resolve(null),
    unlink: noop,
    mkdir: noop,
    writeFile: noop,
    readFile: () => Promise.resolve(''),
    ls: () => Promise.resolve([]),
  },
  config: () => ({
    fetch: () => {
      // Return a thenable with .progress()/.cancel() so callers like
      // localModelManager.ts don't throw when chaining those methods.
      const promise = Promise.resolve(null) as Promise<null> & {
        progress: (cb: unknown) => unknown;
        cancel: () => void;
      };
      promise.progress = () => promise;
      promise.cancel = () => {};
      return promise;
    },
  }),
};

export default RNBlobUtil;
