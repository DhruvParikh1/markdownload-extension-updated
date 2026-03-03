Mathematics stands as the universal language that has shaped civilizations, propelled technological advancements and uncovered mysteries of the universe.

The book "17 Equations That Changed The World" by Ian Stewart outlines 17 fundamental equations that helped shape the modern world. This article explores how these math equations could be written in JavaScript and, in doing so, aims to make these complex concepts more understandable.

## Table of contents

1.  [The Pythagorean Theorem](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#the-pythagorean-theorem)
2.  [Logarithms](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#logarithms)
3.  [Calculus](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#calculus)
4.  [Newton's universal law of gravitation](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#newtons-universal-law-of-gravitation)
5.  [Complex numbers](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#complex-numbers)
6.  [Euler's formula for polyhedra](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#eulers-formula-for-polyhedra)
7.  [The normal distribution](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#the-normal-distribution)
8.  [The wave equation](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#the-wave-equation)
9.  [The Fourier transform](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#the-fourier-transform)
10.  [The Navier-Stokes equations](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#the-navierstokes-equations)
11.  [Maxwell's equations](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#maxwells-equations)
12.  [Second law of thermodynamics](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#second-law-of-thermodynamics)
13.  [Einstein's theory of relativity](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#einsteins-theory-of-relativity)
14.  [Schrödinger equation](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#schrdinger-equation)
15.  [Shannon's information theory](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#shannons-information-theory)
16.  [Logistic model for population growth](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#logistic-model-for-population-growth)
17.  [Black–Scholes model](https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript#blackscholes-model)

## The Pythagorean Theorem

**$c^2 = a^2 + b^2$**

The Pythagorean Theorem is a fundamental principle in mathematics, which states that the square of the hypotenuse of a right-angled triangle is equal to the sum of the squares of the other two sides. It has practical applications in fields such as architecture, engineering, physics, and computer science. The importance of this theorem extends beyond its mathematical utility, providing a foundation for logical reasoning and problem-solving that has influenced centuries of scientific thought and technological advancement.

In the above equation, $c$ is the length of the hypotenuse, and $a$ and $b$ are the lengths of the other two sides.

In JavaScript, you can write a function to calculate the length of the hypotenuse given $a$ and $b$ like this:

```javascript
function calculateHypotenuse(a, b) {  return Math.sqrt(a * a + b * b);}
// Example usage:const a = 3;const b = 4;const hypotenuse = calculateHypotenuse(a, b);console.log(`Hypotenuse: ${hypotenuse}`);
```

___

## Logarithms

**$\log(xy) = \log(x) + \log(y)$**

Logarithms are the inverse of exponentiation and help solve equations involving exponential growth. They're crucial in science and engineering for dealing with quantities that vary over wide ranges. Logarithms also play a key role in modern computing by simplifying the manipulation of large numbers.

To rewrite this equation in JavaScript, you can use the `Math.log()` function, which computes the natural logarithm (base $e$) of a number. Here's how you can represent this equation in JavaScript:

```cpp
// Assuming x and y are positive numbersconst x = /* some positive value */;const y = /* some positive value */;
const logxy = Math.log(x * y);const logx_plus_logy = Math.log(x) + Math.log(y);
// Now logxy should be equal to logx_plus_logyconsole.log(logxy === logx_plus_logy); // This will log true if both sides are equal
```

In this example, set `x` and `y` each to a positive number to calculate and compare both sides of the equation. This will show you that `log(xy)` is indeed equal to `log(x) + log(y)` due to the properties of logarithms.

___

## Calculus

**$f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}$**

Calculus is a foundational branch of modern mathematics, comprising differential and integral calculus. Differential calculus measures how a function changes as its input changes, while integral calculus deals with the accumulation of quantities. It solves problems impossible by algebra alone and finds applications in various fields, such as physics, engineering, economics, and medicine. Through calculus, we can predict planetary paths, design structures, and understand population growth.

The equation above is known as the derivative's definition equation. The code below is a straightforward implementation of the equation using JavaScript. This example approximates the derivative of a function at a given point by calculating the slope of the secant line through two points on the function, where these points are very close together.

```lua
function derivative(f, x, h = 1e-5) {  return (f(x + h) - f(x)) / h;}
// Example usage:// Define a function, for example, f(x) = x^2function square(x) {  return x * x;}
// Calculate the derivative of f(x) = x^2 at x = 3const x = 3;const derivativeAtX = derivative(square, x);console.log(  `Derivative of f(x) = x^2 at x = ${x} is approx: ${derivativeAtX}`);
```

The `derivative` function approximates the derivative of the function $f$ at the point $x$. It does this by taking a small step $h$ and calculating the slope of the secant line that intersects the function at $x$ and $x + h$.

The output of this script gives the slope of the tangent line to $f(x) = x^2$ at $x = 3$, which is the derivative of $f$ at that point. For $x^2$, the exact derivative at any point $x$ is $2x$, so at $x = 3$, we expect the derivative to be 6. The JavaScript function should give a result very close to this, demonstrating both the power and the limitations of numerical derivative approximation.

___

## Newton's universal law of gravitation

**$F = G \frac{m_1 m_2}{r^2}$**

Newton's Universal Law of Gravitation, formulated by Sir Isaac Newton in the 17th century, states that every particle of matter in the universe attracts every other particle with a force that is directly proportional to the product of their masses and inversely proportional to the square of the distance between their centers. This elegant equation explains the motion of celestial bodies and falling apples, unifying celestial and terrestrial mechanics under one law. Newton's law of gravitation paved the way for Einstein's theory of general relativity and remains fundamental in predicting the gravitational interaction between objects, revealing the underlying simplicity and unity in the natural world.

This law is mathematically represented by the above equation where:

-   $F$ is the magnitude of the gravitational force between the two masses
-   $G$ is the gravitational constant ($6.674 \times 10^{-11} \, \text{Nm}^2/\text{kg}^2$)
-   $m_1$ and $m_2$ are the masses of the two objects
-   $r$ is the distance between the centers of the two masses

Here's how you could implement this in JavaScript:

```javascript
function calculateGravitationalForce(m1, m2, r) {  const G = 6.674e-11; // Gravitational constant in N(m^2)/(kg^2)  return (G * (m1 * m2)) / (r * r);}
// Example usage:const m1 = 5.972e24; // Mass of Earth in kgconst m2 = 7.348e22; // Mass of the Moon in kgconst r = 384400e3; // Distance between Earth and Moon in meters
const force = calculateGravitationalForce(m1, m2, r);console.log(  `The gravitational force between Earth and Moon is ${force} N`);
```

This function `calculateGravitationalForce` takes the masses of two objects and the distance between their centers as input, and returns the gravitational force between them. The example calculates the gravitational force between the Earth and the Moon based on their masses and the average distance between them.

This implementation demonstrates the application of Newton's Universal Law of Gravitation using JavaScript, making it possible to calculate the gravitational force between any two masses given their masses and the distance between them. This can be useful in educational software, simulations, and scientific calculations related to physics.

___

## Complex numbers

**$i^2 = -1$**

Complex numbers, composed of a real part and an imaginary part, extend the concept of one-dimensional number lines into two dimensions, thereby revolutionizing mathematics. Introduced to solve equations that have no real solutions, such as $x^2 = -1$, complex numbers are fundamental in expressing solutions to a wide range of mathematical problems. Their importance lies not only in solving polynomial equations, which is where the imaginary unit $\sqrt{-1}$ plays a crucial role but also in their application across various fields of science and engineering. Complex numbers simplify the analysis of electrical circuits, facilitate the description of quantum mechanics, and are pivotal in signal processing, including the design and analysis of filters, oscillators, and the transformation of signals for both analysis and practical applications. The beauty of complex numbers is that they provide a comprehensive framework for solving problems that would otherwise be intractable, making them indispensable in both theoretical and applied mathematics.

Implementing complex numbers in JavaScript involves creating a structure to handle both the real and imaginary parts of complex numbers since JavaScript does not natively support complex numbers. For the above equation, $i$ is the imaginary unit, which is the square root of -1.

Here's a basic class in JavaScript to represent complex numbers and to implement operations such as multiplication, which you can use to demonstrate $i^2 = -1$.

```javascript
class Complex {  constructor(real, imaginary) {    this.real = real;    this.imaginary = imaginary;  }
  // Add another complex number to this one  add(other) {    return new Complex(      this.real + other.real,      this.imaginary + other.imaginary    );  }
  // Multiply this complex number by another complex number  multiply(other) {    // (a + bi) * (c + di) = (ac - bd) + (ad + bc)i    const realPart =      this.real * other.real - this.imaginary * other.imaginary;    const imaginaryPart =      this.real * other.imaginary + this.imaginary * other.real;    return new Complex(realPart, imaginaryPart);  }
  // Display complex number in a readable format  toString() {    return `${this.real} + ${this.imaginary}i`;  }}
// Demonstrating i^2 = -1const i = new Complex(0, 1); // Representing the imaginary unit iconst iSquared = i.multiply(i); // Calculating i^2
console.log(`i^2 = ${iSquared}`); // Should output: i^2 = -1 + 0i
```

This Complex class provides a straightforward way to work with complex numbers in JavaScript, including adding and multiplying them. The multiply method implements the formula for multiplying two complex numbers.

The example demonstrates creating the imaginary unit $i$ as a complex number with 0 real part and 1 as the imaginary part, then multiplying $i$ by itself to show that $i^2$ results in -1 (plus 0 times the imaginary unit, which is typically omitted when it equals 0).

___

## Euler's formula for polyhedra

**$V - E + F = 2$**

Euler's formula for polyhedra, where $V$ stands for the number of vertices, $E$ for the number of edges, and $F$ for the number of faces, is a simple yet powerful relationship discovered by Leonhard Euler in the 18th century. This formula holds true for all convex polyhedra, including the five Platonic solids, and reveals a fundamental characteristic of geometric structures. Its importance lies in its ability to unify the properties of a wide variety of shapes within a single framework, offering deep insights into the topology of three-dimensional spaces. Euler's formula is foundational in the fields of geometry and topology, providing a critical tool for mathematicians and scientists to explore the properties of more complex structures, such as networks and graphs.

You can write a JavaScript function to check if a given set of vertices, edges, and faces satisfies Euler's formula like this:

```javascript
function satisfiesEulersFormula(vertices, edges, faces) {  return vertices - edges + faces === 2;}
// Example usage:const vertices = 8; // For a cubeconst edges = 12; // For a cubeconst faces = 6; // For a cube
console.log(  `Does the given polyhedron satisfy Euler's formula? ${satisfiesEulersFormula(    vertices,    edges,    faces  )}`);
```

This function simply takes the numbers of vertices, edges, and faces of a polyhedron as inputs and checks if they satisfy Euler's formula. You can use this function to verify the formula for various polyhedra by changing the `vertices`, `edges`, and `faces` variables accordingly.

___

## The normal distribution

**$f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2} \left(\frac{x - \mu}{\sigma}\right)^2}$**

The normal distribution is a foundational concept in statistics and probability theory. It describes the spread of data around the mean. It arises naturally in various situations and is significant because of the Central Limit Theorem. This theorem states that the sum of many independent random variables will approximately follow a normal distribution. The normal distribution is a crucial tool in inferential statistics, allowing for the creation of confidence intervals and hypothesis tests. It is essential for statistical modelling and prediction.

The above equation represents the probability density function (PDF) of the normal distribution where:

-   $x$ is the variable
-   $\mu$ is the mean of the distribution
-   $\sigma$ is the standard deviation of the distribution
-   $e$ is the base of the natural logarithm ($\approx 2.71828$)
-   $\pi$ is Pi (\\approx 3.14159)

In JavaScript, you can write a function to compute the PDF of the normal distribution for a given $x$, $\mu$ (mean), and $\sigma$ (standard deviation) as follows:

```javascript
function normalDistributionPDF(x, mu, sigma) {  const sqrtTwoPi = Math.sqrt(2 * Math.PI);  const exponent = -0.5 * ((x - mu) / sigma) ** 2;  return (1 / (sigma * sqrtTwoPi)) * Math.exp(exponent);}
// Example usage:const mu = 0; // Meanconst sigma = 1; // Standard deviation (for a standard normal distribution)const x = 1; // Value to evaluate the PDF at
const pdfValue = normalDistributionPDF(x, mu, sigma);console.log(`PDF value at x = ${x}: ${pdfValue}`);
```

This function calculates the value of the probability density function (PDF) of the normal distribution at a specific point $x$, given the distribution's mean ($\mu$) and standard deviation ($\sigma$). The function is useful for statistical analyses, including probability and statistics applications, data analysis, and machine learning algorithms, where the normal distribution plays a crucial role.

___

## The wave equation

**$\frac{\partial^2 u}{\partial t^2} = c^2 \frac{\partial^2 u}{\partial x^2}$**

The wave equation is a fundamental partial differential equation that describes the propagation of waves, such as sound waves, light waves, and water waves, through various media. It is vital across numerous fields of physics and engineering because it captures the essence of wave behavior in a mathematically precise form. The wave equation's importance lies in its versatility and generality; it can model the spread of ripples on a pond, the travel of light in a vacuum, and the propagation of seismic waves through the Earth. Understanding and solving the wave equation allows scientists and engineers to predict wave behavior, design communication systems, analyze structural responses to vibrations, and explore the universe through the lenses of optics and acoustics, demonstrating its profound impact on technology and our understanding of the natural world.

The above equation represents a one-dimensional wave moving along the $x$\-axis where:

-   $u(x, t)$ is the displacement of the wave at position $x$ and time $t$
-   $c$ is the speed of the wave in the medium
-   $\frac{\partial^2 u}{\partial t^2}$ is the second partial derivative of $u$ with respect to time, indicating acceleration
-   $\frac{\partial^2 u}{\partial x^2}$ is the second partial derivative of $u$ with respect to position, indicating curvature of the wave

Simulating or solving the wave equation in JavaScript requires numerical methods, as analytical solutions are only available for specific initial and boundary conditions. A simple approach to numerically solve this equation is to use the finite difference method (FDM), discretizing both time and space. Here's a basic implementation idea:

```perl
function simulateWaveEquation(c, length, duration, dx, dt) {  // c: wave speed  // length: length of the medium  // duration: total time of simulation  // dx: space step  // dt: time step
  // Calculate the number of points in space and time  const nx = Math.floor(length / dx) + 1;  const nt = Math.floor(duration / dt) + 1;
  // Stability condition (Courant condition)  const courantCondition = ((c * dt) / dx) ** 2;  if (courantCondition > 1) {    throw new Error(      "Simulation may be unstable. Try adjusting dt or dx."    );  }
  // Initialize wave at t=0 and t=1 (assuming initial condition and first time derivative)  let u = new Array(nx).fill(0); // Initial displacement  let uPrev = [...u]; // Copy of the initial displacement  let uNext = new Array(nx).fill(0); // Next time step
  // Example: A simple initial condition (e.g., a peak in the middle)  u[Math.floor(nx / 2)] = 1;
  for (let i = 1; i < nt; i++) {    for (let j = 1; j < nx - 1; j++) {      // Implementing the finite difference method for the wave equation      uNext[j] =        2 * u[j] -        uPrev[j] +        courantCondition * (u[j - 1] - 2 * u[j] + u[j + 1]);    }
    // Update the previous and current solutions    uPrev = [...u];    u = [...uNext];  }
  // Return the final state (for the sake of demonstration)  return u;}
// Example parametersconst c = 1; // Wave speedconst length = 10; // Length of the mediumconst duration = 2; // Total time of simulationconst dx = 0.1; // Space stepconst dt = 0.01; // Time step
const finalWaveState = simulateWaveEquation(  c,  length,  duration,  dx,  dt);console.log(finalWaveState);
```

This code sets up a basic structure for simulating the wave equation under very simplified conditions. It assumes fixed ends (the wave cannot move at the endpoints), which is reflected by not updating `uNext[0]` and `uNext[nx-1]` (the first and last points). The simulation uses an initial condition where there's a peak in the middle of the medium, and it evolves according to the wave equation.

This example uses a very basic initial condition and does not account for more complex scenarios or boundary conditions. For actual applications, you'd need to adapt the initialization and possibly the update loop to reflect your specific needs, including different initial conditions, boundary conditions, and more sophisticated numerical methods for stability and accuracy.

___

## The Fourier transform

**$X_k = \sum_{n=0}^{N-1} x_n \cdot e^{-\frac{2\pi i}{N} kn}$**

The Fourier Transform is a mathematical tool essential for breaking down functions, signals, or waveforms into their constituent frequencies, much like decomposing a musical chord into individual notes. This transformation from the time domain to the frequency domain provides a powerful method for analyzing and understanding complex systems across various fields.

The implementation here is for the Discrete Fourier Transform (DFT), since the Fast Fourier Transform (FFT) - a more efficient algorithm for computing the DFT - is a little too complex for this example.

The above formula can be described as follows:

-   $X_k$ is the $k$th component of the transformed signal
-   $x_n$ is the $n$th sample of the original signal
-   $N$ is the total number of samples
-   $e$ is the base of the natural logarithm
-   $i$ is the imaginary unit ($\sqrt{-1}$)

Here's how you could write a function in JavaScript to compute the DFT of a signal:

```javascript
function discreteFourierTransform(signal) {  const N = signal.length;  let X = new Array(N);
  for (let k = 0; k < N; k++) {    let sum = 0;
    for (let n = 0; n < N; n++) {      const phi = (2 * Math.PI * k * n) / N;      sum += signal[n] * (Math.cos(phi) - Math.sin(phi) * 1j);    }
    X[k] = sum;  }
  return X;}
// Example usage:const signal = [0, 1, 2, 3, 4, 5, 6, 7]; // An example signalconst DFT = discreteFourierTransform(signal);console.log(DFT);
```

However, JavaScript does not natively support complex numbers (like the `1j` in the code), so you need to implement or use a library for complex arithmetic. Here's a basic way to handle complex numbers and adapt the DFT function accordingly:

```javascript
class Complex {  constructor(re, im = 0) {    this.re = re;    this.im = im;  }
  add(other) {    return new Complex(this.re + other.re, this.im + other.im);  }
  multiply(other) {    return new Complex(      this.re * other.re - this.im * other.im,      this.re * other.im + this.im * other.re    );  }
  static exp(phi) {    return new Complex(Math.cos(phi), Math.sin(phi));  }}
function discreteFourierTransform(signal) {  const N = signal.length;  let X = new Array(N).fill(null).map(() => new Complex(0));
  for (let k = 0; k < N; k++) {    let sum = new Complex(0, 0);
    for (let n = 0; n < N; n++) {      const phi = (-2 * Math.PI * k * n) / N;      const c = Complex.exp(phi);      sum = sum.add(c.multiply(new Complex(signal[n])));    }    X[k] = sum;  }  return X;}// Example usage:const signal = [0, 1, 2, 3, 4, 5, 6, 7]; // An example signalconst DFT = discreteFourierTransform(signal).map(  (c) => `${c.re.toFixed(2)}, ${c.im.toFixed(2)}`);console.log(DFT);
```

This adapted version uses a `Complex` class to handle complex numbers and their arithmetic, enabling the DFT calculation to work correctly. The DFT output is an array of `Complex` objects, where each represents a frequency component of the original signal. The `toFixed(2)` method is used to format the output for readability, showing each component's real and imaginary parts. Keep in mind, for large signals or real-world applications, you'd likely use an existing library or the FFT algorithm for efficiency.

___

## The Navier-Stokes equations

**$\frac{\partial \mathbf{u}}{\partial t} + (\mathbf{u} \cdot \nabla) \mathbf{u} = -\frac{1}{\rho} \nabla p + \nu \nabla^2 \mathbf{u} + \mathbf{f}$**

The Navier-Stokes equations, named after Claude-Louis Navier and George Gabriel Stokes, are a set of nonlinear partial differential equations that describe the motion of fluid substances such as liquids and gases. These equations are foundational in fluid dynamics, capturing the essence of fluid flow phenomena by accounting for various forces acting on a fluid particle, including pressure, viscous, and external forces. The importance of the Navier-Stokes equations cannot be overstated; they are crucial for modeling weather patterns, designing aircraft and automobiles, understanding ocean currents, and analyzing the flow of blood in the human body. Furthermore, they play a critical role in environmental science, chemical engineering, and astrophysics. Solving these equations helps predict the behavior of fluids in complex scenarios, making them indispensable tools for engineers, physicists, and mathematicians in advancing technology and understanding natural phenomena.

Implementing this equation in JavaScript for a simulation of fluid dynamics involves discretizing the equation and solving it numerically. This task is quite complex and typically requires a significant amount of code, especially for handling various boundary conditions and ensuring numerical stability. For this reason, it's only really feasible to show a simplified example here that sketches out the basic structure for a very simplified case, such as a 2D fluid in a uniform grid, with some assumptions to keep things manageable.

This example won't fully solve the Navier-Stokes equations but will illustrate how you might set up the structure for a solver using finite difference methods for spatial derivatives and Euler's method for the time derivative.

Assumptions:

-   The fluid is incompressible ($\nabla \cdot \mathbf{u} = 0$)
-   The density $\rho$ is constant
-   We're working in a 2D domain with $x$ and $y$ dimensions
-   External forces $\mathbf{f}$ are neglected for simplicity
-   Time stepping with a simple Euler method

```cpp
// Parametersconst nx = 20; // Number of grid points in x directionconst ny = 20; // Number of grid points in y directionconst nu = 0.01; // Kinematic viscosityconst dt = 0.1; // Time stepconst rho = 1.0; // Density, assuming constant
// Initialize velocity and pressure fieldsconst u = new Array(ny).fill(0).map(() => new Array(nx).fill(0));const v = new Array(ny).fill(0).map(() => new Array(nx).fill(0));const p = new Array(ny).fill(0).map(() => new Array(nx).fill(0));
// Function to approximate the first derivatives using central differencefunction derivative(arr, dx, axis) {  const result = new Array(arr.length)    .fill(0)    .map(() => new Array(arr[0].length).fill(0));  for (let i = 1; i < arr.length - 1; i++) {    for (let j = 1; j < arr[i].length - 1; j++) {      if (axis === "x") {        result[i][j] = (arr[i][j + 1] - arr[i][j - 1]) / (2 * dx);      } else if (axis === "y") {        result[i][j] = (arr[i + 1][j] - arr[i - 1][j]) / (2 * dx);      }    }  }  return result;}
// Function to approximate the second derivatives using central differencefunction secondDerivative(arr, dx) {  // Similar to derivative function but for second derivatives  // This is a placeholder; implementation would be similar to the first derivative}
// Main update function (simplified and not fully accurate)function updateVelocity(u, v, p, nu, dt, dx, dy) {  // Calculate derivatives  const uxx = secondDerivative(u, dx);  const uyy = secondDerivative(u, dy);  const vxx = secondDerivative(v, dx);  const vyy = secondDerivative(v, dy);
  const ux = derivative(u, dx, "x");  const uy = derivative(u, dy, "y");  const vx = derivative(v, dx, "x");  const vy = derivative(v, dy, "y");  const px = derivative(p, dx, "x");  const py = derivative(p, dy, "y");
  // Update velocities (simplified Euler integration)  for (let i = 1; i < ny - 1; i++) {    for (let j = 1; j < nx - 1; j++) {      u[i][j] -=        dt *        (u[i][j] * ux[i][j] +          v[i][j] * uy[i][j] +          px[i][j] / rho +          nu * (uxx[i][j] + uyy[i][j]));      v[i][j] -=        dt *        (u[i][j] * vx[i][j] +          v[i][j] * vy[i][j] +          py[i][j] / rho +          nu * (vxx[i][j] + vyy[i][j]));    }  }}
// Placeholder function for pressure calculation// Real implementation would solve the pressure Poisson equationfunction updatePressure(p, u, v, dx, dy) {  // This is a placeholder; actual implementation is complex}
// Example of running an updateupdateVelocity(u, v, p, nu, dt, 1.0 / nx, 1.0 / ny);
```

As mentioned, this code does not directly solve the Navier-Stokes equations but provides a structure that demonstrates how you could go about implementing them.

___

## Maxwell's equations

**$\nabla \times \mathbf{H} = \mathbf{J} + \epsilon_0\frac{\partial \mathbf{E}}{\partial t}$**

Maxwell's equations, formulated by James Clerk Maxwell in the 19th century, are a set of fundamental laws that govern electricity and magnetism. The equations describe how electric charges and currents create electric and magnetic fields and how those fields interact with each other and with matter. Maxwell's equations are crucial for understanding and predicting the behavior of electromagnetic fields in various contexts, from classical electrodynamics to modern physics. They underpin virtually all modern electrical and electronic technologies, including generators, motors, radio, television, and telecommunications.

Implementing the above equation in JavaScript involves simulating how a magnetic field ($H$) is affected by both an electric current density ($J$) and the time rate of change of the electric field ($E$). This simulation can get complex because it involves vector calculus and time-dependent changes in electromagnetic fields. However, a simplified approach can illustrate the concept. First, let's define what each term represents in a discretized space, assuming uniform linear materials and ignoring boundary conditions for simplicity. We won't directly solve the equation but rather demonstrate how to set up the values for a simulation step.

Assuming:

-   $H$ is a magnetic field vector
-   $J$ is the current density vector
-   $E$ is the electric field vector
-   $\epsilon_0$ is the vacuum permittivity
-   $\frac{\partial \mathbf{E}}{\partial t}$ is approximated by the finite difference $\frac{\Delta \mathbf{E}}{\Delta t}$

Here is how you could write this in JavaScript:

```javascript
const epsilon0 = 8.854187817e-12; // Vacuum permittivity in F/m (farads per meter)
// Example vectors represented as arrays [x, y, z]const H = [0, 0, 1]; // Example magnetic field vectorconst J = [0.1, 0.1, 0]; // Example current density vectorconst E = [1, 0, 0]; // Initial electric field vectorconst E_prev = [0.9, 0, 0]; // Electric field vector at previous time stepconst deltaTime = 0.1; // Time step in seconds
// Function to calculate the rate of change of the electric fieldfunction rateOfChangeE(E, E_prev, deltaTime) {  return E.map((value, index) => (value - E_prev[index]) / deltaTime);}
// Function to update the magnetic field based on Ampère's Law with Maxwell's additionfunction updateMagneticField(H, J, rateOfChangeE, epsilon0) {  // Assuming a simple model where each component of H is updated directly  // This is a conceptual demonstration and not a direct numerical solution of the curl equation  return H.map(    (value, index) =>      value + J[index] + epsilon0 * rateOfChangeE[index]  );}
// Calculate the rate of change of Econst rateOfChangeEVector = rateOfChangeE(E, E_prev, deltaTime);
// Update the magnetic field Hconst updatedH = updateMagneticField(  H,  J,  rateOfChangeEVector,  epsilon0);
console.log(`Updated Magnetic Field H: [${updatedH.join(", ")}]`);
```

This code calculates the rate of change of the electric field vector ($E$) between two time steps and uses it to update the magnetic field vector ($H$) based on Ampère's Law with Maxwell's addition.

The `rateOfChangeE` function computes the temporal rate of change of $E$ using a simple finite difference approximation.

The `updateMagneticField` function updates $H$ by adding both the effects of the current density ($J$) and the time derivative of $E$ scaled by $\epsilon_0$.

This demonstration is highly simplified and abstracts away the complexity of solving the vector differential equations. In a real application, solving Maxwell's equations for $H$ and $E$ fields often requires numerical methods like finite element analysis (FEA) or finite difference time domain (FDTD) methods, and typically, such computations are performed using specialized software or libraries designed for computational electromagnetics.

___

## Second law of thermodynamics

**$\Delta S = \frac{Q}{T}$**

The Second Law of Thermodynamics is a fundamental principle of physics that states that the total entropy, or disorder, of an isolated system, can never decrease over time; it can only remain constant or increase. This law highlights the irreversible nature of natural processes, indicating that energy transformations are not 100% efficient, as some energy is always lost to disorder. The importance of the Second Law extends beyond theoretical physics into practical applications: it governs the efficiency limits of engines, refrigerators, and all energy conversion devices, shaping our understanding of energy management, sustainability, and the universe's ultimate fate. It explains why perpetual motion machines are impossible and drives the direction of heat transfer, making it indispensable in engineering, chemistry, and environmental science.

While the Second Law itself is a principle rather than a mathematical formula, we can illustrate an aspect of it by calculating the change in entropy ($\Delta S$) for a given process. A simple way to calculate the entropy change in a system when heat is transferred is by using the above formula.

Where:

-   $\Delta S$ is the change in entropy
-   $Q$ is the heat added to the system (in joules)
-   $T$ is the absolute temperature of the system (in kelvins)

This formula assumes a reversible process and constant temperature for simplicity. Here's how you might write a JavaScript function to calculate this:

```javascript
function calculateEntropyChange(heat, temperature) {  // heat: heat added to the system in joules  // temperature: absolute temperature in kelvins  if (temperature <= 0) {    throw new Error("Temperature must be greater than 0 K");  }
  const deltaS = heat / temperature;  return deltaS; // Change in entropy in joules per kelvin (J/K)}
// Example usage:const heat = 1000; // Heat added in joulesconst temperature = 300; // Absolute temperature in kelvins
const entropyChange = calculateEntropyChange(heat, temperature);console.log(`Change in entropy: ${entropyChange} J/K`);
```

This function calculates the change in entropy for a given amount of heat added to or removed from a system at a constant temperature. Keep in mind, this is a simplified model. In real scenarios, calculating entropy changes can involve more complex considerations, especially if the process is not reversible or the temperature is not constant.

The Second Law of Thermodynamics underpins much of physical chemistry and thermodynamics, including the direction of heat transfer, the efficiency of engines, and the spontaneous nature of certain chemical reactions. For more complex systems or processes, the calculations would need to account for the specific conditions and interactions occurring within the system.

___

## Einstein's theory of relativity

**$E = mc^2$**

Einstein's theory of relativity, encompassing both the Special and General theories, revolutionized our understanding of space, time, and gravity. Introduced in the early 20th century, Special Relativity challenged conventional notions by showing that the laws of physics are the same for all non-accelerating observers and that the speed of light within a vacuum is constant, regardless of the observer's velocity. This led to profound implications, including time dilation and length contraction. General Relativity further extended these ideas, proposing that gravity is not a force between masses but rather an effect of the curvature of spacetime caused by mass and energy. Einstein's theories are crucial for modern physics, underpinning technologies like GPS and insights into the universe's structure, from the behavior of black holes to the expansion of the cosmos.

The equations that comprise Einstein's theory of relativity are too complex to demonstrate here but the classic equation $E = mc^2$ that states that matter and energy are equivalent to each other is simple enough to demonstrate.

In this equation, $c$ is the speed of light in a vacuum, approximately $3.00 \times 10^8$ meters per second. This equation shows that mass can be converted into energy and vice versa.

For a simple JavaScript function that calculates the energy equivalent of a given mass using this equation, you could write:

```javascript
function massEnergyEquivalence(mass) {  const speedOfLight = 3.0e8; // Speed of light in meters per second  return mass * Math.pow(speedOfLight, 2);}
// Example usage:const mass = 1; // 1 kilogramconst energy = massEnergyEquivalence(mass);console.log(`Energy equivalent of ${mass} kg: ${energy} joules`);
```

This function calculates the energy (in joules) equivalent to a given mass (in kilograms).

___

## Schrödinger equation

**$-\frac{\hbar^2}{2m}\frac{d^2\psi(x)}{dx^2} + V(x)\psi(x) = E\psi(x)$**

The Schrödinger equation, formulated by Erwin Schrödinger in 1926, is a foundational equation in quantum mechanics that describes how the quantum state of a physical system changes over time. It is crucial for understanding the behavior of particles at atomic and subatomic scales, embodying the wave-particle duality central to quantum theory. The equation provides a way to calculate the probability amplitude for the position and momentum of particles, allowing for the prediction of an array of physical properties and phenomena, such as energy levels, bonding structures, and the behavior of electrons in atoms. Its significance extends beyond theoretical physics, influencing chemistry, materials science, and the development of technologies like semiconductors, lasers, and quantum computing.

Writing the Schrödinger equation in JavaScript involves a simplification, as the equation itself is a complex partial differential equation used to describe the quantum state of a physical system. The above equation is the time-independent Schrödinger equation in one dimension where:

-   $h$ is the reduced Planck's constant
-   $m$ is the mass of the particle
-   $\frac{d^2\psi(x)}{dx^2}$ is the second derivative of the wave function $\psi(x)$ with respect to position $x$
-   $V(x)$ is the potential energy as a function of position
-   $E$ is the total energy of the particle
-   $\psi(x)$ is the wave function of the particle

Solving this equation analytically or numerically for $\psi(x)$ given a potential $V(x)$ requires understanding of differential equations and numerical methods, which can be complex and beyond the scope of a simple JavaScript function.

However, I can illustrate how you might set up a structure for solving a simplified version of the Schrödinger equation numerically, for example, using the finite difference method (FDM) for a particle in a box where $V(x)=0$ inside the box and infinite outside. This is a highly simplified scenario and serves for educational purposes:

```cpp
// Constantsconst hbar = 1.0545718e-34; // Reduced Planck's constant (Joule-second)const m = 9.10938356e-31; // Mass of an electron (kg)
// Potential energy function V(x), assuming a particle in a box where V(x) = 0function V(x) {  return 0;}
// Simplified setup for the Schrödinger equation in a "particle in a box" scenariofunction solveSchrodinger(N, L) {  // N: Number of points  // L: Length of the box (meters)
  const dx = L / (N - 1); // Step size  const dx2 = dx * dx;  const factor = Math.pow(-hbar, 2) / (2 * m * dx2);
  // Initialize the wave function array and potential energy array  let psi = new Array(N).fill(0);  let potential = new Array(N).fill(0).map((_, i) => V(i * dx));
  // Example: Finite difference method (FDM) setup (not fully implemented)  // This is a placeholder to illustrate where the FDM or other numerical method would go
  // Return the wave function (this is a simplified placeholder)  return psi;}
// Example usage (this is a conceptual example and not a complete solution)const N = 100; // Number of pointsconst L = 1e-10; // Length of the box in meters (e.g., 1 nm)const psi = solveSchrodinger(N, L);
console.log(psi); // This would output the wave function array (placeholder values)
```

This script sets up a basic structure but does not actually solve the Schrödinger equation, as implementing a numerical solution (like the finite difference method) requires more complex code and understanding of numerical analysis. The real challenge in solving the Schrödinger equation numerically is in setting up and solving the associated linear algebra problem, which typically involves constructing and diagonalizing a Hamiltonian matrix that represents the equation. For real-world applications, you would likely use specialized numerical libraries and software designed for scientific computations, such as SciPy in Python, rather than implementing from scratch in JavaScript.

___

## Shannon's information theory

**$H(X) = -\sum_{i=1}^{n} P(x_i) \log_b P(x_i)$**

Shannon's Information Theory, introduced by Claude Shannon in 1948, marks a cornerstone in the fields of communication and data processing. It quantitatively defines the concept of information, introducing measures of information content, entropy, and redundancy. By establishing the fundamental limits on compressing data and reliably transmitting it over noisy channels, Shannon's work laid the groundwork for modern digital communications and data storage technologies. Its importance extends far beyond telecommunications, influencing computer science, cryptography, linguistics, and cognitive sciences.

Shannon's information theory, particularly the concept of entropy, quantifies the amount of uncertainty or information contained in a message. The entropy ($H$) of a discrete random variable with possible values $x_1, x_2, \ldots, x_n$ and probability mass function $P(x)$ is the above equation.

Where $b$ is the base of the logarithm used, commonly 2 (for bits), e (nats), or 10 (for Hartleys). When $b = 2$, the unit of entropy is bits, which is most common in information theory.

Here's how you could implement the calculation of entropy in JavaScript:

```javascript
function calculateEntropy(probabilities, base = 2) {  // probabilities: an array of probabilities for each outcome  // base: the base of the logarithm (default is 2 for bits)
  const log =    base === 2 ? Math.log2 : base === Math.E ? Math.log : Math.log10;
  let entropy = 0;  for (let p of probabilities) {    if (p > 0) {      // Ensure probability is positive to avoid NaN results      entropy -= p * log(p);    }  }
  return entropy;}
// Example usage:const probabilities = [0.5, 0.5]; // Fair coin flip probabilities for heads and tailsconst entropyBits = calculateEntropy(probabilities); // Default is base 2console.log(`Entropy: ${entropyBits} bits`);
// For a more complex example, probabilities of a dice rollconst diceProbabilities = [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];const entropyDice = calculateEntropy(diceProbabilities);console.log(`Entropy of a fair dice roll: ${entropyDice} bits`);
```

This function `calculateEntropy` calculates the Shannon entropy of a distribution given its probabilities and the base of the logarithm. The entropy measures the average information content you can expect from a random variable's outcome. In the context of information theory, a higher entropy value means more uncertainty or more information content in the message, while a lower entropy value indicates less uncertainty or redundancy.

___

## Logistic model for population growth

**$P_{n+1} = r P_n (1 - P_n)$**

The logistic model for population growth, as re-examined by Robert May in the 1970s, marked a pivotal shift in how scientists view dynamical systems and their applications to biological populations. May's work demonstrated that simple nonlinear models, like the logistic equation, could exhibit chaotic behavior under certain conditions. This insight was groundbreaking because it challenged the prevailing notion that complex behaviors in nature required complex models. By applying the logistic model to populations, May showed that population dynamics could be unpredictable and highly sensitive to initial conditions, a hallmark of chaos theory. His research underscored the importance of considering nonlinear effects and chaos in ecological models, influencing fields beyond ecology, including economics, meteorology, and epidemiology.

The above equation assumes the following:

-   $P_n$ is the population at time step $n$
-   $r$ is the growth rate
-   $P_{n+1}$ is the population at the next time step ($n+1$)

In this model, the population size is normalized such that the carrying capacity $K = 1$, and $P_n$ represents the proportion of the carrying capacity (hence, $0 \leq P_n \leq 1$).

Here is how you could implement the logistic map in JavaScript:

```javascript
function logisticMap(r, P0, n) {  // r: growth rate  // P0: initial population proportion (0 <= P0 <= 1)  // n: number of iterations/generations
  let P = P0; // Initialize population size
  for (let i = 0; i < n; i++) {    P = r * P * (1 - P); // Apply logistic map equation  }
  return P;}
// Example usage:const r = 3.5; // Growth rateconst P0 = 0.5; // Initial population proportion (as a fraction of carrying capacity)const n = 10; // Number of iterations
const populationAtN = logisticMap(r, P0, n);console.log(  `Population proportion at iteration ${n}: ${populationAtN}`);
```

This function calculates the population proportion after $n$ iterations, starting from an initial proportion $P_0$ and growing at a rate $r$. The value of $r$ is critical in this model; depending on its value, the system can exhibit stable, periodic, or chaotic behavior. For example, when $r$ is between 1 and 3, the population size reaches a stable equilibrium. Between 3 and approximately 3.57, the population enters a period of oscillations, and beyond 3.57, the system can show chaotic behavior, meaning small changes in the initial condition ($P_0$) or the parameter $r$ can lead to vastly different outcomes.

___

## Black–Scholes model

**$C = S_0 \cdot N(d_1) - K \cdot e^{-rT} \cdot N(d_2)$**

**$P = K \cdot e^{-rT} \cdot N(-d_2) - S_0 \cdot N(-d_1)$**

The Black-Scholes model, developed in the early 1970s by economists Fischer Black, Myron Scholes, and later expanded by Robert Merton, revolutionized the field of financial economics by providing a theoretical framework for valuing European options and derivatives. This groundbreaking model calculates the price of options by considering several variables, including the underlying asset's price, the option's strike price, the time to expiration, risk-free interest rates, and the asset's volatility. The Black-Scholes formula's importance lies in its ability to provide a consistent and precise method for pricing options, which before its introduction, lacked a scientific basis.

The above eqations can be used to calculate the theoretical price of European call and put options, respectively, where:

-   $C$ is the call option price
-   $P$ is the put option price
-   $S_0$ is the current stock price
-   $K$ is the strike price of the option
-   $r$ is the risk-free interest rate
-   $T$ is the time to maturity (in years)
-   $N(\cdot)$ is the cumulative distribution function of the standard normal distribution
-   $d_1$ and $d_2$ are calculated as follows:

$d_1 = \frac{\ln(\frac{S_0}{K}) + (r + \frac{\sigma^2}{2})T}{\sigma\sqrt{T}}$

$d_2 = d_1 - \sigma\sqrt{T}$

-   $\sigma$ is the volatility of the stock's return

In JavaScript, you can calculate the call and put option prices with the Black-Scholes formula like this:

```javascript
function normCDF(x) {  // Approximation of the cumulative distribution function for the standard normal distribution  const a1 = 0.254829592;  const a2 = -0.284496736;  const a3 = 1.421413741;  const a4 = -1.453152027;  const a5 = 1.061405429;  const p = 0.3275911;  const t = 1 / (1 + p * x);  const y =    1 -    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *      t *      Math.exp(-x * x);
  return 0.5 * (1 + Math.sign(x) * y);}
function blackScholes(S, K, T, r, sigma, optionType) {  const d1 =    (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) /    (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);  if (optionType === "call") {    return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);  } else if (optionType === "put") {    return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);  } else {    throw new Error("optionType must be either 'call' or 'put'");  }}
// Example usage:const currentStockPrice = 100; // Sconst strikePrice = 100; // Kconst timeToMaturity = 1; // T in yearsconst riskFreeInterestRate = 0.05; // rconst volatility = 0.2; // sigma
const callOptionPrice = blackScholes(  currentStockPrice,  strikePrice,  timeToMaturity,  riskFreeInterestRate,  volatility,  "call");const putOptionPrice = blackScholes(  currentStockPrice,  strikePrice,  timeToMaturity,  riskFreeInterestRate,  volatility,  "put");
console.log("Call Option Price: " + callOptionPrice.toFixed(2));console.log("Put Option Price: " + putOptionPrice.toFixed(2));
```

This JavaScript function calculates the price of a call or put option based on the Black-Scholes model. Note that `normCDF` is an approximation of the cumulative distribution function of the standard normal distribution, which is used to calculate $N(d_1)$ and $N(d_2)$. Remember, the Black-Scholes model has limitations and assumptions, such as constant volatility and no dividends, which might not hold true in all market conditions.

___

## Final thoughts

If you'd like to try running any of the above code examples, one of the easiest ways of doing this is by using RunJS. [RunJS](https://runjs.app/) is a desktop application that takes the pain out of setting up and running JavaScript and TypeScript code. Available for macOS, Windows and Linux. It provides you with a convenient and easy-to-use environment for running code with instant side-by-side results, so you can see exactly what your code is doing.

![relativity in javascript](https://runjs.app/static/blog/equations/relativity-in-javascript.png)

Try it now for free. Just [head over to the homepage](https://runjs.app/) to download it.
