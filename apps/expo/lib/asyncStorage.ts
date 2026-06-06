// @react-native-async-storage/async-storage ships a localStorage-backed web
// implementation out of the box, so a single re-export works on every
// platform. This wrapper exists so call sites never import the native module
// path directly (per the lib/ wrapper convention).
export { default } from '@react-native-async-storage/async-storage';
