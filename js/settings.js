/**
 * نظام إدارة إعدادات API
 * يوفر واجهة لتكوين وإدارة إعدادات الاتصال مع API
 */

class APISettings {
    constructor() {
        this.storageKey = 'apiSettings';
        this.defaultSettings = {
            apiBaseUrl: '',
            apiKey: '',
            apiTimeout: 30,
            apiVersion: 'v1',
            enableEncryption: true,
            verifySSL: true,
            recordsPerPage: 20,
            autoRefresh: 5,
            retryAttempts: 3,
            enableLogging: false
        };
    }

    /**
     * تحميل الإعدادات من localStorage
     */
    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? { ...this.defaultSettings, ...JSON.parse(stored) } : this.defaultSettings;
        } catch (error) {
            console.error('خطأ في تحميل الإعدادات:', error);
            return this.defaultSettings;
        }
    }

    /**
     * حفظ الإعدادات في localStorage
     */
    save(settings) {
        try {
            const toSave = {
                ...this.load(),
                ...settings,
                lastUpdated: new Date().toISOString()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(toSave));
            return true;
        } catch (error) {
            console.error('خطأ في حفظ الإعدادات:', error);
            return false;
        }
    }

    /**
     * إعادة تعيين الإعدادات للقيم الافتراضية
     */
    reset() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('خطأ في إعادة تعيين الإعدادات:', error);
            return false;
        }
    }

    /**
     * التحقق من صحة الإعدادات
     */
    validate(settings) {
        const errors = [];

        if (!settings.apiBaseUrl) {
            errors.push('رابط API الأساسي مطلوب');
        } else if (!this.isValidUrl(settings.apiBaseUrl)) {
            errors.push('رابط API غير صحيح');
        }

        if (settings.apiTimeout < 5 || settings.apiTimeout > 300) {
            errors.push('مهلة الاتصال يجب أن تكون بين 5 و 300 ثانية');
        }

        if (settings.recordsPerPage < 1 || settings.recordsPerPage > 500) {
            errors.push('عدد السجلات لكل صفحة يجب أن يكون بين 1 و 500');
        }

        return errors;
    }

    /**
     * التحقق من صحة الرابط
     */
    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * اختبار الاتصال مع API
     */
    async testConnection(settings) {
        if (!settings.apiBaseUrl) {
            throw new Error('رابط API غير محدد');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), settings.apiTimeout * 1000);

        try {
            const response = await fetch(`${settings.apiBaseUrl}/api/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(settings.apiKey && { 'Authorization': `Bearer ${settings.apiKey}` })
                },
                signal: controller.signal
            });

            clearTimeout(timeout);

            return {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                responseTime: Date.now()
            };
        } catch (error) {
            clearTimeout(timeout);
            
            if (error.name === 'AbortError') {
                throw new Error('انتهت مهلة الاتصال');
            }
            throw error;
        }
    }

    /**
     * إنشاء كائن التكوين للطلبات
     */
    createRequestConfig(token = null) {
        const settings = this.load();
        
        return {
            baseUrl: settings.apiBaseUrl || window.location.origin,
            headers: {
                'Content-Type': 'application/json',
                ...(settings.apiKey && { 'X-API-Key': settings.apiKey }),
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            timeout: settings.apiTimeout * 1000,
            retryAttempts: settings.retryAttempts || 3
        };
    }

    /**
     * تصدير الإعدادات كملف JSON
     */
    export() {
        const settings = this.load();
        const exportData = {
            ...settings,
            apiKey: '***', // إخفاء مفتاح API للأمان
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    /**
     * استيراد الإعدادات من ملف JSON
     */
    async import(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    
                    // التحقق من صحة البيانات المستوردة
                    const errors = this.validate(imported);
                    if (errors.length > 0) {
                        reject(new Error(`بيانات غير صحيحة: ${errors.join(', ')}`));
                        return;
                    }
                    
                    // حفظ الإعدادات الجديدة
                    if (this.save(imported)) {
                        resolve(imported);
                    } else {
                        reject(new Error('فشل في حفظ الإعدادات'));
                    }
                } catch (error) {
                    reject(new Error('ملف غير صحيح'));
                }
            };
            
            reader.onerror = () => reject(new Error('خطأ في قراءة الملف'));
            reader.readAsText(file);
        });
    }
}

// إنشاء مثيل عام من فئة الإعدادات
window.apiSettings = new APISettings();
