// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { defaultScopes, SpotifyAuthProvider, UpdateableAuthenticationSession } from './authProvider';
import { SpotifyUriHandler } from './uriHandler';
import { SpotifyChatResponseHandler } from './chatParticipant';
import { BetterTokenStorage } from './betterSecretStorage';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const uriHandler = new SpotifyUriHandler();
	context.subscriptions.push(uriHandler);
	const tokenStorage = new BetterTokenStorage<UpdateableAuthenticationSession>(context.extension.id, context);
	const authProvider = new SpotifyAuthProvider(uriHandler, tokenStorage);
	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
	context.subscriptions.push(vscode.authentication.registerAuthenticationProvider(
		SpotifyAuthProvider.id,
		SpotifyAuthProvider.label,
		authProvider
	));
	let disposable = vscode.commands.registerCommand('vscode-vibe.play-songs', async (uris: string[]) => {
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
	});

	context.subscriptions.push(vscode.chat.createChatParticipant('vibe', new SpotifyChatResponseHandler(authProvider).handle));

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
