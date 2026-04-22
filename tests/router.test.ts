import { routeModel } from '../.opencode/plugins/pangkas/router';

describe('routeModel', () => {
  it('memilih ollama untuk task ringan', () => {
    expect(routeModel('Tugas ringan saja')).toBe('ollama');
  });
  it('memilih gemini untuk task cepat', () => {
    expect(routeModel('Butuh cepat')).toBe('gemini');
  });
  it('default ke claude', () => {
    expect(routeModel('Analisis data besar')).toBe('claude');
  });
});
