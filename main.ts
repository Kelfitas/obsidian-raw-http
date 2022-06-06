import { Editor, MarkdownView, Plugin } from 'obsidian';
import { makeRequest, formatRequest } from './req';

interface RawHTTPRequestSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: RawHTTPRequestSettings = {
	mySetting: 'default'
}

export default class RawHTTPRequest extends Plugin {
	settings: RawHTTPRequestSettings;

	async onload() {
		await this.loadSettings();

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('...');

		this.addCommand({
			id: 'make-request',
			name: 'Make request',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const sel = editor.getSelection();
				const request = formatRequest(sel);
				const config = {
					host: request.headers['Host'],
					port: 443,
					isSSL: true,
				};
				statusBarItemEl.setText('...');
				const response = await makeRequest(config, request);
				console.clear();
				console.log(response.raw);

				statusBarItemEl.setText(`${response.statusCode} ${response.statusMessage}`);
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

