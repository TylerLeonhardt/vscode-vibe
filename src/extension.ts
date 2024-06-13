// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SpotifyAuthProvider } from './authProvider';
import { SpotifyUriHandler } from './uriHandler';
import { SpotifyChatResponseHandler } from './chatParticipant';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const authProvider = new SpotifyAuthProvider(context.secrets);
	await authProvider.initialize();
	context.subscriptions.push(vscode.Disposable.from(
		authProvider,
		vscode.authentication.registerAuthenticationProvider(SpotifyAuthProvider.id, SpotifyAuthProvider.label, authProvider),
		vscode.chat.createChatParticipant('vibe', new SpotifyChatResponseHandler(authProvider).handle),
		vscode.commands.registerCommand('vscode-vibe.play-songs', async (uris?: string[]) => {
			if (!uris?.length) {
				return;
			}
			const client = await authProvider.getSpotifyClient();
			// const token = (await authProvider.getSessions(defaultScopes))[0].accessToken;
			const state = await client.player.getPlaybackState();
			let deviceId = state.device.id;
			if (!deviceId) {
				const devices = await client.player.getAvailableDevices();
				const deviceQuickPickItems = devices.devices.map(device => ({
					label: device.name,
					description: device.type,
					device
				}));

				const selectedDevice = await vscode.window.showQuickPick(deviceQuickPickItems, {
					placeHolder: 'Select a device'
				});

				if (selectedDevice) {
					deviceId = selectedDevice.device.id;
				}
				if (!deviceId) {
					return;
				}
			}
			await client.player.startResumePlayback(deviceId, undefined, uris);
		})
	));
}

// This method is called when your extension is deactivated
export function deactivate() {}
