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
    fetch: () => Promise.resolve(null),
  }),
};

export default RNBlobUtil;
