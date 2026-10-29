# On-device AI

Lets a user chat with PackRat's assistant with no signal, keeping everything they type on their own device.

## The model in one paragraph

The AI chat has two modes: Cloud and On-device. Cloud is the default and the most capable: it can look up the user's packs, the gear catalog, weather and guides. On-device answers from a language model running on the phone, tablet or Mac itself, so it works on a ridge with no coverage and nothing leaves the device. On devices with Apple Intelligence, On-device is ready the moment it is chosen. On other devices that can run it, the user downloads a model once, over Wi-Fi if they like, and from then on it works offline. Devices that cannot run a model well do not offer the mode at all, rather than offering something slow or unreliable.

## Choosing a mode

The mode switch sits at the top of the AI chat. Switching is instant and applies to the next message; the conversation so far stays on screen and carries over. The chosen mode is remembered between launches. If On-device is chosen but cannot answer yet (Apple Intelligence turned off or still preparing, or the model not downloaded), the chat shows what to do in place of sending, and Cloud stays one tap away.

## Apple Intelligence devices

On iPhone 15 Pro and newer, and on iPads and Macs with Apple silicon, running a recent OS with Apple Intelligence on, On-device uses the model built into the system. There is nothing to download and nothing to manage. If Apple Intelligence is switched off or still preparing, the mode explains that and offers the way to turn it on.

## Downloaded model

On other devices with enough memory, On-device uses Gemma, a compact open model. Choosing On-device the first time shows the download size and asks before starting. The download shows progress, can be cancelled, picks up where it stopped after an interruption, and waits for Wi-Fi unless the user allows cellular data. Once downloaded, the model loads in a few seconds the first time a chat uses it. The model can be deleted from Settings to free space, and downloaded again later.

## What an on-device answer is

On-device answers stream in as they are written, the same as Cloud. They draw on the conversation and general outdoor knowledge, plus the pack or gear item the chat was opened from. They do not search the catalog, read other packs, or fetch live data; when a question needs that, the answer says so and suggests Cloud. Long conversations keep their most recent turns in view.

## User controls

- The Cloud / On-device switch in the AI chat.
- In Settings, under On-device AI: which model the device uses, its size on disk, download or delete, and whether downloads may use cellular data.

## What this feature does not do

- No choice between several downloadable models; each device gets one.
- No image, voice or document input on-device.
- No tool use on-device: catalog search, pack edits, web search and live weather stay Cloud-only.
- No syncing of on-device conversations to other devices.
- No automatic switching between modes based on signal.
