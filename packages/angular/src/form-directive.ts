import { Directive, ElementRef, Input, inject } from "@angular/core"
import { router, type Method, type VisitOptions } from "@kolektiv/keel"

/** Options for {@link KeelFormDirective}; a string is shorthand for `action`. */
export interface KeelFormOptions
  extends Pick<
    VisitOptions,
    | "replace"
    | "preserveScroll"
    | "preserveState"
    | "headers"
    | "force"
    | "onBefore"
    | "onSuccess"
    | "onError"
  > {
  action: string
  method?: Method
  resetOnSuccess?: boolean
}

/**
 * Form submission through `router.visit`, the Angular counterpart of the
 * other adapters' `Form` components. Serializes the native `FormData`, keeps
 * `preserveState: true` by default, and resets the fields on success when
 * `resetOnSuccess` is set. The `action` and `method` attributes stay on the
 * element, so a no-JS submit still reaches the host.
 *
 * ```html
 * <form [keelForm]="'/notes'" method="post">
 *   <input name="body" />
 * </form>
 * ```
 */
@Directive({
  selector: "form[keelForm]",
  standalone: true,
  host: {
    "(submit)": "onSubmit($event)",
  },
})
export class KeelFormDirective {
  /** Action plus visit options, or a bare action string. */
  @Input() keelForm: string | KeelFormOptions = ""

  private readonly element = inject<ElementRef<HTMLFormElement>>(ElementRef)

  private get options(): KeelFormOptions {
    return typeof this.keelForm === "string" ? { action: this.keelForm } : this.keelForm
  }

  onSubmit(event: SubmitEvent): void {
    if (event.defaultPrevented) return
    event.preventDefault()
    const form = this.element.nativeElement
    const options = this.options
    void router.visit(options.action, {
      method: options.method ?? "post",
      data: new FormData(form),
      preserveScroll: options.preserveScroll ?? false,
      preserveState: options.preserveState ?? true,
      replace: options.replace ?? false,
      headers: options.headers,
      force: options.force ?? false,
      onBefore: options.onBefore,
      onError: options.onError,
      onSuccess(page) {
        if (options.resetOnSuccess) form.reset()
        options.onSuccess?.(page)
      },
    })
  }
}
