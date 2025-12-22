declare module "neo-blessed" {
	interface Blessed {
		Widgets: {
			Screen: any;
			Log: any;
			Box: any;
			List: any;
			Button: any;
		};

		screen(options?: any): any;
		log(options?: any): any;
		box(options?: any): any;
		list(options?: any): any;
		button(options?: any): any;

		cleanup(): void;

		[key: string]: any;
	}

	const blessed: Blessed;
	export default blessed;
}
