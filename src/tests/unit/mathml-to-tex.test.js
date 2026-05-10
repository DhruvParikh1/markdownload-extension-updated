const { JSDOM } = require('jsdom');
const mathMLApi = require('../../shared/mathml-to-tex');

function parseMath(markup) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${markup}</body>`);
  return dom.window.document.querySelector('math');
}

describe('MathML to TeX conversion', () => {
  test('converts ScienceDirect-style subscripts from MathML', () => {
    const math = parseMath(`
      <math>
        <mrow>
          <msub>
            <mi>P</mi>
            <mrow><mi>i</mi><mo>,</mo><mi>j</mi><mo>,</mo><mi>t</mi><mo>_</mo><mi>a</mi></mrow>
          </msub>
          <mspace width="0.25em"></mspace>
          <mtext>and</mtext>
          <mspace width="0.25em"></mspace>
          <msub>
            <mi>P</mi>
            <mrow><mi>i</mi><mo>,</mo><mi>j</mi><mo>,</mo><mi>t</mi></mrow>
          </msub>
        </mrow>
      </math>
    `);

    expect(mathMLApi.mathmlToTex(math)).toBe('P_{i,j,t_a}\\,\\text{and}\\,P_{i,j,t}');
  });

  test('uses TeX annotations when MathML provides them', () => {
    const math = parseMath(`
      <math>
        <semantics>
          <mrow><msup><mi>x</mi><mn>2</mn></msup></mrow>
          <annotation encoding="application/x-tex">x^2</annotation>
        </semantics>
      </math>
    `);

    expect(mathMLApi.mathmlToTex(math)).toBe('x^2');
  });

  test('converts common presentation structures', () => {
    const math = parseMath(`
      <math display="block">
        <mrow>
          <mi>f</mi>
          <mo>=</mo>
          <mfrac>
            <mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow>
            <msqrt><mi>c</mi></msqrt>
          </mfrac>
        </mrow>
      </math>
    `);

    expect(mathMLApi.mathmlToTex(math)).toBe('f=\\frac{a+b}{\\sqrt{c}}');
    expect(mathMLApi.isDisplayMath(math)).toBe(true);
  });

  test('converts piecewise tables to cases', () => {
    const math = parseMath(`
      <math>
        <mrow>
          <mi>f</mi>
          <mo>=</mo>
          <mrow>
            <mo>{</mo>
            <mtable>
              <mtr><mtd><mn>1</mn></mtd><mtd><mtext>if x &gt; 0</mtext></mtd></mtr>
              <mtr><mtd><mn>0</mn></mtd><mtd><mtext>otherwise</mtext></mtd></mtr>
            </mtable>
          </mrow>
        </mrow>
      </math>
    `);

    expect(mathMLApi.mathmlToTex(math)).toBe('f=\\begin{cases}1 & \\text{if x > 0} \\\\ 0 & \\text{otherwise}\\end{cases}');
  });

  test('keeps word-like identifiers valid when they contain underscores', () => {
    const math = parseMath(`
      <math>
        <mrow>
          <msub>
            <mrow>
              <mi>n</mi><mi>u</mi><mi>m</mi><mi>b</mi><mi>e</mi><mi>r</mi>
              <mo>_</mo>
              <mi>o</mi><mi>f</mi>
              <mo>_</mo>
              <mi>b</mi><mi>u</mi><mi>y</mi><mi>s</mi>
            </mrow>
            <mrow><mi>i</mi><mo>,</mo><mi>t</mi></mrow>
          </msub>
        </mrow>
      </math>
    `);

    expect(mathMLApi.mathmlToTex(math)).toBe('\\mathrm{number\\_of\\_buys}_{i,t}');
  });
});
