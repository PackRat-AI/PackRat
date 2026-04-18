/**
 * Web stub for react-native-ios-context-menu.
 * iOS context menus are not supported on web. Renders children directly.
 */
const React = require('react');

const ContextMenuView = ({ children }) => children ?? null;
ContextMenuView.displayName = 'ContextMenuView';

const ContextMenuButton = ({ children }) => children ?? null;
ContextMenuButton.displayName = 'ContextMenuButton';

module.exports = {
  default: ContextMenuView,
  ContextMenuView,
  ContextMenuButton,
};
