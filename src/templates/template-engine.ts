export class TemplateEngine {
    private static templates: Map<string, string> = new Map();

    static registerTemplate(name: string, template: string): void {
        this.templates.set(name, template);
    }

    static render(templateName: string, data: any): string {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }

        return this.processTemplate(template, data);
    }

    private static processTemplate(template: string, data: any): string {
        return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const value = this.getValue(data, key.trim());
            return value !== undefined ? String(value) : match;
        });
    }

    private static getValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    static renderConditional(condition: boolean, trueTemplate: string, falseTemplate: string = ''): string {
        return condition ? trueTemplate : falseTemplate;
    }

    static renderLoop<T>(items: T[], itemTemplate: string): string {
        return items.map(item => this.processTemplate(itemTemplate, item)).join('');
    }
}
