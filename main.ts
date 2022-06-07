import { App, PluginSettingTab, Setting, Editor, MarkdownView, Plugin } from 'obsidian';
import { makeRequest, formatRequest } from './req';

interface RawHTTPSettings {
	useProxy: boolean;
	proxyHost: string;
	proxyPort: string;
}

const DEFAULT_SETTINGS: RawHTTPSettings = {
	useProxy: false,
	proxyHost: '127.0.0.1',
	proxyPort: '8080',
}

export default class RawHTTP extends Plugin {
	settings: RawHTTPSettings;

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
					proxyConfig: {
						useProxy: this.settings.useProxy,
						host: this.settings.proxyHost,
						port: this.settings.proxyPort,
					}
				};
				statusBarItemEl.setText('...');
				console.clear();
				console.log('Loading...');
				const response = await makeRequest(config, request);
				console.clear();
				console.log(response.raw);

				statusBarItemEl.setText(`${response.statusCode} ${response.statusMessage}`);
			}
		});

		this.addSettingTab(new ProxySettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ProxySettingTab extends PluginSettingTab {
	plugin: RawHTTP;

	constructor(app: App, plugin: RawHTTP) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Raw HTTP.'});

		new Setting(containerEl)
			.setName('Proxy Enabled')
			.addToggle(bool => bool
				.setValue(this.plugin.settings.useProxy)
				.onChange(async (value) => {
					this.plugin.settings.useProxy = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Proxy Host')
			.addText(text => text
				.setPlaceholder('Enter proxy host')
				.setValue(this.plugin.settings.proxyHost)
				.onChange(async (value) => {
					this.plugin.settings.proxyHost = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Proxy Port')
			.addText(text => text
				.setPlaceholder('Enter proxy port')
				.setValue(this.plugin.settings.proxyPort)
				.onChange(async (value) => {
					this.plugin.settings.proxyPort = value;
					await this.plugin.saveSettings();
				}));
	}
}

