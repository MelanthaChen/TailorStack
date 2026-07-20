export class DiffGenerator {
  generate({ operations }) {
    return operations.map((operation, index) => ({
      index,
      ...operation
    }));
  }
}
