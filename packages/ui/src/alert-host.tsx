import * as React from 'react';
import { AlertAnchor, type AlertButtonDef, type AlertMethods } from './alert';

/**
 * One app-wide `Alert`, so screens and hooks can raise a dialog with `showAlert({ title, message,
 * buttons })`, the arguments of RN's `Alert.alert`, without each mounting their own anchor. On
 * Android that is the MD3 Compose `AlertDialog`; on iOS the `Alert` entry point is already the
 * native `UIAlertController`.
 */
const hostRef = React.createRef<AlertMethods>();

function AlertHost() {
  return <AlertAnchor ref={hostRef} />;
}

function showAlert({
  title,
  message,
  buttons = [{ text: 'OK' }],
}: {
  title: string;
  message?: string;
  buttons?: AlertButtonDef[];
}) {
  hostRef.current?.alert({ title, message, buttons });
}

export { AlertHost, showAlert };
